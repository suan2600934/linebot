import tkinter as tk
from tkinter import ttk, messagebox
import requests
import json
import os
import sys
import logging
import sqlite3
import hmac
import hashlib
import base64
from datetime import datetime
from dbfread import DBF, FieldParser

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
BINDING_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bindings.db")

_B52UC_MAP = None

def _load_b52uc_map(config_path=None):
    global _B52UC_MAP
    if _B52UC_MAP is not None:
        return _B52UC_MAP
    mapping = {}
    path = config_path or r"H:\clinic_file\B52UC.TXT"
    try:
        with open(path, "r", encoding="ascii", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line.startswith("0x"):
                    continue
                parts = line.split()
                if len(parts) < 2:
                    continue
                try:
                    b5 = int(parts[0], 16)
                    uc = int(parts[1], 16)
                    mapping[b5] = uc
                except ValueError:
                    continue
    except FileNotFoundError:
        mapping = None
    _B52UC_MAP = mapping
    return _B52UC_MAP

def _decode_big5_bytes(raw: bytes, b52uc_path=None) -> str:
    raw = raw.rstrip(b" \x00")
    if not raw:
        return ""
    out = []
    i = 0
    b52uc = _load_b52uc_map(b52uc_path)
    while i < len(raw):
        b1 = raw[i]
        if b1 <= 0x7F:
            out.append(chr(b1))
            i += 1
            continue
        if i + 1 >= len(raw):
            out.append("?")
            break
        b2 = raw[i + 1]
        chunk = bytes([b1, b2])
        try:
            out.append(chunk.decode("cp950", errors="strict"))
        except UnicodeDecodeError:
            code = (b1 << 8) | b2
            if b52uc and code in b52uc:
                out.append(chr(b52uc[code]))
            else:
                out.append("?")
        i += 2
    return "".join(out)

class _RawFieldParser(FieldParser):
    def parseC(self, field, data):
        return data

def load_config():
    if not os.path.exists(CONFIG_PATH):
        raise FileNotFoundError(f"找不到設定檔：{CONFIG_PATH}\n請先複製 config.example.json 為 config.json 並填入正確路徑。")
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)

def setup_logging():
    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = os.path.join(LOG_DIR, f"{datetime.now().strftime('%Y-%m-%d')}.log")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stdout)
        ]
    )

def init_binding_db():
    conn = sqlite3.connect(BINDING_DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS binding_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            binder_name TEXT NOT NULL,
            binder_idno TEXT,
            binder_birth TEXT,
            patient_name TEXT NOT NULL,
            patient_idno TEXT,
            patient_birth TEXT,
            recno TEXT NOT NULL,
            recno_hash TEXT NOT NULL,
            binding_time TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now', '+8 hours'))
        )
    """)
    try:
        conn.execute("SELECT binder_birth FROM binding_records LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE binding_records ADD COLUMN binder_birth TEXT")
        conn.execute("ALTER TABLE binding_records ADD COLUMN patient_birth TEXT")
    conn.commit()
    conn.close()
    logging.info(f"本地綁定資料庫初始化完成：{BINDING_DB_PATH}")

def compute_recno_hash(recno, app_key_b64):
    key = base64.b64decode(app_key_b64)
    return hmac.new(key, recno.encode('utf-8'), hashlib.sha256).hexdigest()

def save_binding_record(binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time):
    conn = sqlite3.connect(BINDING_DB_PATH)
    try:
        conn.execute("""
            INSERT INTO binding_records (binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        """, (binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time))
        conn.commit()
        logging.info(f"本地綁定記錄寫入成功：{binder_name} 綁定 {patient_name} ({recno})")
        return True
    except sqlite3.IntegrityError:
        conn.execute("DELETE FROM binding_records WHERE recno_hash = ?", (recno_hash,))
        conn.execute("""
            INSERT INTO binding_records (binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        """, (binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time))
        conn.commit()
        logging.info(f"重新啟用綁定記錄：{binder_name} 綁定 {patient_name} ({recno})")
        return True
    finally:
        conn.close()

def check_existing_binding(binder_name, recno_hash):
    conn = sqlite3.connect(BINDING_DB_PATH)
    rows = conn.execute("""
        SELECT id, binder_name, patient_name, recno, binding_time, status
        FROM binding_records
        WHERE binder_name = ? AND recno_hash = ? AND status = 'active'
    """, (binder_name, recno_hash)).fetchall()
    conn.close()
    return rows

def get_active_binding_records():
    conn = sqlite3.connect(BINDING_DB_PATH)
    rows = conn.execute("""
        SELECT id, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status
        FROM binding_records WHERE status = 'active' ORDER BY binding_time DESC
    """).fetchall()
    conn.close()
    return rows

def check_existing_binding(binder_name, recno_hash):
    conn = sqlite3.connect(BINDING_DB_PATH)
    rows = conn.execute("""
        SELECT id, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, binding_time, status
        FROM binding_records
        WHERE binder_name = ? AND recno_hash = ? AND status = 'active'
    """, (binder_name, recno_hash)).fetchall()
    conn.close()
    return rows

def format_birth(birth):
    if not birth or len(birth) != 6:
        return birth or ''
    return f"{birth[:2]}/{birth[2:4]}/{birth[4:6]}"

def search_binding_records(keyword, search_type='all'):
    conn = sqlite3.connect(BINDING_DB_PATH)
    if search_type == 'binder':
        rows = conn.execute("""
            SELECT id, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status
            FROM binding_records
            WHERE (binder_name LIKE ? OR binder_idno LIKE ? OR binder_birth LIKE ?) AND status = 'active' ORDER BY binding_time DESC
        """, (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%')).fetchall()
    elif search_type == 'patient':
        rows = conn.execute("""
            SELECT id, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status
            FROM binding_records
            WHERE (patient_name LIKE ? OR patient_idno LIKE ? OR patient_birth LIKE ? OR recno LIKE ?) AND status = 'active' ORDER BY binding_time DESC
        """, (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%')).fetchall()
    else:
        rows = conn.execute("""
            SELECT id, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status
            FROM binding_records
            WHERE (binder_name LIKE ? OR binder_idno LIKE ? OR binder_birth LIKE ?
               OR patient_name LIKE ? OR patient_idno LIKE ? OR patient_birth LIKE ? OR recno LIKE ?) AND status = 'active' ORDER BY binding_time DESC
        """, (f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%', f'%{keyword}%')).fetchall()
    conn.close()
    return rows

def update_binding_status(recno_hash, new_status):
    conn = sqlite3.connect(BINDING_DB_PATH)
    conn.execute("UPDATE binding_records SET status = ? WHERE recno_hash = ?", (new_status, recno_hash))
    conn.commit()
    conn.close()

def load_patdb(path, b52uc_path=None):
    logging.info(f"正在讀取 patdb：{path}")
    records = []
    skipped = 0
    db = DBF(path, load=True, parserclass=_RawFieldParser)
    for idx, record in enumerate(db, start=1):
        try:
            clean = {}
            for k, v in record.items():
                if isinstance(v, (bytes, bytearray)):
                    clean[k] = _decode_big5_bytes(bytes(v), b52uc_path)
                else:
                    clean[k] = v
            clean["_recno"] = idx
            records.append(clean)
        except Exception as e:
            skipped += 1
            logging.warning(f"第 {idx} 筆記錄解析失敗：{e}")
            continue
    logging.info(f"共載入 {len(records)} 筆資料")
    if skipped:
        logging.warning(f"共跳過 {skipped} 筆無法解析的記錄")
    return records

def search_records(records, keyword):
    kw = keyword.strip().lower()
    if not kw:
        return []
    results = []
    for rec in records:
        name = str(rec.get("NAME", "")).lower()
        idno = str(rec.get("ID", "")).lower()
        birth = str(rec.get("BIRTH", "")).lower()
        if kw in name or kw in idno or kw in birth:
            results.append(rec)
    return results

def call_create_verify_code(api_base, recno):
    url = f"{api_base}/api/create-verify-code"
    payload = {"recno": str(recno)}
    logging.info(f"呼叫 API：{url}，recno={recno}")
    resp = requests.post(url, json=payload, timeout=15)
    resp.raise_for_status()
    return resp.json()

def call_get_link_by_recno_hash(api_base, recno_hash, api_key):
    url = f"{api_base}/api/admin/links-by-recno-hash?recno_hash={recno_hash}"
    logging.info(f"查詢 linkId：recno_hash={recno_hash}")
    resp = requests.get(url, headers={"x-unbind-api-key": api_key}, timeout=15)
    resp.raise_for_status()
    return resp.json()

def call_admin_unbind(api_base, link_id, api_key):
    url = f"{api_base}/api/admin/unbind"
    logging.info(f"執行解除綁定：linkId={link_id}")
    resp = requests.post(url, json={"linkId": link_id}, headers={"x-unbind-api-key": api_key}, timeout=15)
    resp.raise_for_status()
    return resp.json()

class App:
    def __init__(self, config):
        self.config = config
        self.b52uc_path = config.get("b52ucPath")
        self.records = None
        self.selected_recno = None
        self.selected_name = None
        self.selected_idno = None
        self.selected_birth = None
        self.selected_binder_recno = None
        self.selected_binder_name = None
        self.selected_binder_idno = None
        self.selected_binder_birth = None
        self.pending_binding_info = None

        self.root = tk.Tk()
        self.root.title("賜安診所 - 驗證碼產生器")
        self.root.geometry("900x750")

        style = ttk.Style()
        style.theme_use("default")
        style.configure("ConfirmLine.TButton", foreground="white", background="#0078D7", font=("Microsoft JhengHei", 10, "bold"))
        style.map("ConfirmLine.TButton", background=[("active", "#005a9e"), ("!disabled", "#0078D7")])
        style.configure("ConfirmLineDisabled.TButton", foreground="gray", font=("Microsoft JhengHei", 10))

        self.build_ui()
        self.root.update()
        self.tab1_canvas.bind("<MouseWheel>", lambda e: self.tab1_canvas.yview_scroll(int(-1 * (e.delta / 120)), "units"))

        self.load_data()

    def load_data(self):
        try:
            patdb_path = self.config["patdbPath"]
            if not os.path.exists(patdb_path):
                messagebox.showerror("錯誤", f"patdb 檔案不存在：\n{patdb_path}")
                logging.error(f"patdb 檔案不存在：{patdb_path}")
                return
            self.records = load_patdb(patdb_path, self.b52uc_path)
            self.status_label.config(text=f"已載入 {len(self.records)} 筆資料")
            logging.info("patdb 載入成功")
        except Exception as e:
            messagebox.showerror("錯誤", f"載入 patdb 失敗：\n{e}")
            logging.error(f"載入 patdb 失敗：{e}")

    def build_ui(self):
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=10)

        tab1 = ttk.Frame(self.notebook)
        self.notebook.add(tab1, text="驗證碼產生")
        self.build_tab1(tab1)

        tab2 = ttk.Frame(self.notebook)
        self.notebook.add(tab2, text="綁定管理")
        self.build_tab2(tab2)

    def build_tab1(self, parent):
        canvas_frame = tk.Frame(parent)
        canvas_frame.pack(fill='both', expand=True)
        parent.columnconfigure(0, weight=1)
        parent.rowconfigure(0, weight=1)

        self.tab1_canvas = tk.Canvas(canvas_frame, highlightthickness=0)
        scrollbar = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.tab1_canvas.yview)
        self.tab1_canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side="right", fill="y")
        self.tab1_canvas.pack(side="left", fill="both", expand=True)

        f = ttk.Frame(self.tab1_canvas, padding=15)
        self.tab1_window = self.tab1_canvas.create_window((0, 0), window=f, anchor="nw")

        f.bind("<Configure>", lambda e: self.tab1_canvas.configure(scrollregion=self.tab1_canvas.bbox("all")))
        self.tab1_canvas.bind("<Configure>", lambda e: self.tab1_canvas.itemconfig(self.tab1_window, width=e.width))

        title = ttk.Label(f, text="賜安診所 LINE 綁定驗證碼系統", font=("Microsoft JhengHei", 14, "bold"))
        title.grid(row=0, column=0, columnspan=3, pady=(0, 5))

        note = ttk.Label(f, text="請先選「綁定人」（A），再選「被綁定人」（B）", foreground="red", font=("Microsoft JhengHei", 10))
        note.grid(row=1, column=0, columnspan=3, pady=(0, 10))

        binder_frame = ttk.LabelFrame(f, text="【A】綁定人（操作 LINE 的人）", padding=10)
        binder_frame.grid(row=2, column=0, columnspan=3, pady=5, sticky="ew")
        binder_frame.columnconfigure(1, weight=1)

        ttk.Label(binder_frame, text="搜尋（姓名/身份證/生日）：").grid(row=0, column=0, sticky="w", pady=3)
        ttk.Label(binder_frame, text="💡 姓名/身份證/生日/RECNO 任一字元符合即可。生日請輸入6位數，如：490101，顯示會自動轉為 49/01/01", font=("Microsoft JhengHei", 9), foreground="blue").grid(row=1, column=0, columnspan=4, sticky="w", padx=5)
        self.binder_search_var = tk.StringVar()
        binder_entry = ttk.Entry(binder_frame, textvariable=self.binder_search_var, width=30, font=("Microsoft JhengHei", 11))
        binder_entry.grid(row=0, column=1, sticky="ew", pady=3, padx=5)
        binder_entry.bind("<Return>", lambda e: self.do_binder_search())
        binder_entry.focus()

        ttk.Button(binder_frame, text="查詢", command=self.do_binder_search).grid(row=0, column=2, pady=3, padx=2)
        ttk.Button(binder_frame, text="清除", command=self.clear_binder_search).grid(row=0, column=3, pady=3, padx=2)

        binder_list_frame = ttk.Frame(binder_frame)
        binder_list_frame.grid(row=2, column=0, columnspan=4, pady=5, sticky="nsew")
        binder_scrollbar = ttk.Scrollbar(binder_list_frame)
        self.binder_listbox = tk.Listbox(binder_list_frame, width=80, height=4, font=("Microsoft JhengHei", 10), yscrollcommand=binder_scrollbar.set)
        self.binder_listbox.grid(row=0, column=0, sticky="nsew")
        binder_scrollbar.config(command=self.binder_listbox.yview)
        binder_scrollbar.grid(row=0, column=1, sticky="ns")
        binder_list_frame.rowconfigure(0, weight=1)
        binder_list_frame.columnconfigure(0, weight=1)

        self.binder_listbox.bind("<Double-Button-1>", lambda e: self.on_binder_select())

        ttk.Button(binder_frame, text="選擇此人為綁定人", command=self.on_binder_select).grid(row=3, column=0, columnspan=4, pady=3)

        self.binder_info_label = ttk.Label(binder_frame, text="（尚未選擇）", foreground="blue", font=("Microsoft JhengHei", 10))
        self.binder_info_label.grid(row=4, column=0, columnspan=4)

        separator = ttk.Separator(f, orient="horizontal")
        separator.grid(row=3, column=0, columnspan=3, pady=10, sticky="ew")

        patient_frame = ttk.LabelFrame(f, text="【B】被綁定人（要看診的病人）", padding=10)
        patient_frame.grid(row=4, column=0, columnspan=3, pady=5, sticky="ew")
        patient_frame.columnconfigure(1, weight=1)

        ttk.Label(patient_frame, text="搜尋（姓名/身份證/生日）：").grid(row=0, column=0, sticky="w", pady=3)
        ttk.Label(patient_frame, text="💡 姓名/身份證/生日/RECNO 任一字元符合即可。生日請輸入6位數，如：490101，顯示會自動轉為 49/01/01", font=("Microsoft JhengHei", 9), foreground="blue").grid(row=1, column=0, columnspan=4, sticky="w", padx=5)
        self.search_var = tk.StringVar()
        patient_entry = ttk.Entry(patient_frame, textvariable=self.search_var, width=30, font=("Microsoft JhengHei", 11))
        patient_entry.grid(row=0, column=1, sticky="ew", pady=3, padx=5)
        patient_entry.bind("<Return>", lambda e: self.do_search())
        patient_entry.focus()

        ttk.Button(patient_frame, text="查詢", command=self.do_search).grid(row=0, column=2, pady=3, padx=2)
        ttk.Button(patient_frame, text="清除", command=self.clear_search).grid(row=0, column=3, pady=3, padx=2)

        patient_list_frame = ttk.Frame(patient_frame)
        patient_list_frame.grid(row=2, column=0, columnspan=4, pady=5, sticky="nsew")
        patient_scrollbar = ttk.Scrollbar(patient_list_frame)
        self.result_listbox = tk.Listbox(patient_list_frame, width=80, height=4, font=("Microsoft JhengHei", 10), yscrollcommand=patient_scrollbar.set)
        self.result_listbox.grid(row=0, column=0, sticky="nsew")
        patient_scrollbar.config(command=self.result_listbox.yview)
        patient_scrollbar.grid(row=0, column=1, sticky="ns")
        patient_list_frame.rowconfigure(0, weight=1)
        patient_list_frame.columnconfigure(0, weight=1)

        self.result_listbox.bind("<Double-Button-1>", lambda e: self.on_select())

        ttk.Button(patient_frame, text="選擇此人為被綁定人", command=self.on_select).grid(row=3, column=0, columnspan=4, pady=3)

        self.info_label = ttk.Label(patient_frame, text="（尚未選擇）", foreground="blue", font=("Microsoft JhengHei", 10))
        self.info_label.grid(row=4, column=0, columnspan=4)

        confirm_frame = ttk.Frame(f)
        confirm_frame.grid(row=5, column=0, columnspan=3, pady=10)
        self.confirm_btn = ttk.Button(confirm_frame, text="確認並產生驗證碼", command=self.on_confirm_and_generate, state="disabled")
        self.confirm_btn.pack()

        self.confirm_label = ttk.Label(f, text="", foreground="green", font=("Microsoft JhengHei", 11), justify="center")
        self.confirm_label.grid(row=6, column=0, columnspan=3)

        code_frame = ttk.LabelFrame(f, text="驗證碼", padding=10)
        code_frame.grid(row=7, column=0, columnspan=3, pady=10, sticky="nsew")
        self.code_label = ttk.Label(code_frame, text="（尚未產生）", font=("Microsoft JhengHei", 28, "bold"), foreground="red")
        self.code_label.pack()
        self.expiry_label = ttk.Label(code_frame, text="", font=("Microsoft JhengHei", 10))
        self.expiry_label.pack()
        ttk.Button(code_frame, text="複製驗證碼", command=self.copy_code).pack(pady=5)
        self.confirm_line_btn = ttk.Button(code_frame, text="確認 LINE 綁定", command=self.confirm_line_binding, state="disabled", style="ConfirmLineDisabled.TButton")
        self.confirm_line_btn.pack(pady=5)
        self.line_bind_status = ttk.Label(code_frame, text="", foreground="gray", font=("Microsoft JhengHei", 10, "bold"))
        self.line_bind_status.pack()

        self.status_label = ttk.Label(f, text="", foreground="gray")
        self.status_label.grid(row=8, column=0, columnspan=3)

        f.columnconfigure(1, weight=1)

    def build_tab2(self, parent):
        f = ttk.Frame(parent, padding=15)
        f.pack(fill='both', expand=True)
        parent.columnconfigure(0, weight=1)
        parent.rowconfigure(0, weight=1)

        title = ttk.Label(f, text="本地綁定記錄管理", font=("Microsoft JhengHei", 12, "bold"))
        title.pack(anchor='w')

        search_frame = ttk.Frame(f)
        search_frame.pack(fill='x', pady=5)

        ttk.Label(search_frame, text="查詢方式：").pack(side='left', padx=5)
        self.search_mode = tk.StringVar(value="all")
        mode_frame = ttk.Frame(search_frame)
        mode_frame.pack(side='left', padx=5)
        ttk.Radiobutton(mode_frame, text="全部", variable=self.search_mode, value="all", command=self.on_search_mode_change).pack(side='left', padx=2)
        ttk.Radiobutton(mode_frame, text="依綁定人", variable=self.search_mode, value="binder", command=self.on_search_mode_change).pack(side='left', padx=2)
        ttk.Radiobutton(mode_frame, text="依被綁定人", variable=self.search_mode, value="patient", command=self.on_search_mode_change).pack(side='left', padx=2)
        ttk.Radiobutton(mode_frame, text="依時間", variable=self.search_mode, value="time", command=self.on_search_mode_change).pack(side='left', padx=2)

        keyword_frame = ttk.Frame(search_frame)
        keyword_frame.pack(side='left', padx=5)
        ttk.Label(keyword_frame, text="關鍵字：", font=("Microsoft JhengHei", 9)).pack(side='left', padx=2)
        self.bind_search_var = tk.StringVar()
        self.bind_search_entry = ttk.Entry(keyword_frame, textvariable=self.bind_search_var, width=15, font=("Microsoft JhengHei", 10))
        self.bind_search_entry.pack(side='left', padx=2)
        self.bind_search_entry.bind("<Return>", lambda e: self.do_name_search())
        ttk.Button(keyword_frame, text="查詢", command=self.do_name_search).pack(side='left', padx=2)
        ttk.Button(keyword_frame, text="清除", command=self.clear_binding_search).pack(side='left', padx=2)

        hint_frame = ttk.Frame(f)
        hint_frame.pack(fill='x', pady=3)
        ttk.Label(hint_frame, text="💡 姓名/身份證/生日/RECNO/時間 任一字元符合即可。生日請輸入6位數，如：490101。時間格式：2026-07-05（任一字元符合即可）", font=("Microsoft JhengHei", 9), foreground="blue").pack(side='left', padx=5)

        self.time_search_frame = ttk.Frame(search_frame)
        self.time_search_frame.pack(side='left', padx=5)
        ttk.Label(self.time_search_frame, text="時間：", font=("Microsoft JhengHei", 9)).pack(side='left', padx=2)
        self.bind_time_var = tk.StringVar()
        ttk.Entry(self.time_search_frame, textvariable=self.bind_time_var, width=14, font=("Microsoft JhengHei", 10)).pack(side='left', padx=2)
        ttk.Button(self.time_search_frame, text="查詢", command=self.do_binding_time_search).pack(side='left', padx=2)
        ttk.Button(self.time_search_frame, text="清除", command=self.clear_binding_search).pack(side='left', padx=2)
        ttk.Label(self.time_search_frame, text="💡 格式：2026-07-05 任一字元符合即可", font=("Microsoft JhengHei", 9), foreground="blue").pack(side='left', padx=5)
        self.bind_time_var.trace_add('write', lambda *a: self.do_binding_time_search())
        self.time_search_frame.pack_forget()

        list_frame = ttk.Frame(f)
        list_frame.pack(fill='both', expand=True, pady=10)
        scrollbar = ttk.Scrollbar(list_frame)
        self.bind_listbox = tk.Listbox(list_frame, width=90, height=15, font=("Microsoft JhengHei", 10), yscrollcommand=scrollbar.set)
        self.bind_listbox.grid(row=0, column=0, sticky='nsew')
        scrollbar.config(command=self.bind_listbox.yview)
        scrollbar.grid(row=0, column=1, sticky='ns')
        list_frame.rowconfigure(0, weight=1)
        list_frame.columnconfigure(0, weight=1)

        self.bind_listbox.bind('<Double-Button-1>', lambda e: self.on_unbind_select())

        btn_frame = ttk.Frame(f)
        btn_frame.pack(pady=5)
        ttk.Button(btn_frame, text="刷新列表", command=lambda: self.refresh_binding_list()).pack(side='left', padx=5)
        ttk.Button(btn_frame, text="解除綁定", command=self.on_unbind_select).pack(side='left', padx=5)

        self.bind_info_label = ttk.Label(f, text="", foreground="blue", font=("Microsoft JhengHei", 10))
        self.bind_info_label.pack(pady=5)

        guide_frame = ttk.LabelFrame(f, text="櫃台引導", padding=10)
        guide_frame.pack(fill='x', pady=10)
        ttk.Label(guide_frame, text="請病人在 LINE 的「查詢就醫資訊」中操作解除", foreground="green", font=("Microsoft JhengHei", 10)).pack(anchor='w')
        ttk.Label(guide_frame, text="若病人已無法操作LINE，可由櫃台在此輸入密碼後強制解除", foreground="red", font=("Microsoft JhengHei", 9)).pack(anchor='w')

        self.refresh_binding_list()

    def on_search_mode_change(self):
        mode = self.search_mode.get()
        if mode == "time":
            self.bind_search_entry.pack_forget()
            self.time_search_frame.pack(side='left', padx=5)
        else:
            self.time_search_frame.pack_forget()
            self.bind_search_entry.pack(side='left', padx=2)
        self.do_name_search()

    def do_name_search(self):
        mode = self.search_mode.get()
        keyword = self.bind_search_var.get().strip()
        if mode == "time":
            return
        if not keyword:
            self.refresh_binding_list(show_all=True)
            return
        self.refresh_binding_list(show_all=False)

    def clear_binding_search(self):
        self.bind_search_var.set("")
        self.bind_time_var.set("")
        self.search_mode.set("all")
        self.on_search_mode_change()

    def refresh_binding_list(self, show_all=False):
        self.bind_listbox.delete(0, tk.END)
        mode = self.search_mode.get()
        keyword = self.bind_search_var.get().strip()

        if mode == "time":
            filter_time = self.bind_time_var.get().strip()
            if not filter_time:
                self.bind_info_label.config(text="請輸入時間關鍵字（例如：20260705）")
                return
            records = get_active_binding_records()
            records = [r for r in records if filter_time in r[9]]
        elif show_all or not keyword:
            records = get_active_binding_records()
        else:
            records = search_binding_records(keyword, mode)

        for rec in records:
            _, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, _, binding_time, status = rec
            binder_display = f"{binder_name}(生日:{format_birth(binder_birth)}/ID:{binder_idno})" if binder_idno or binder_birth else binder_name
            patient_display = f"{patient_name}(生日:{format_birth(patient_birth)}/ID:{patient_idno})" if patient_idno or patient_birth else patient_name
            display = f"{binder_display} 綁定 {patient_display} | RECNO：{recno} | 綁定時間：{binding_time}"
            self.bind_listbox.insert(tk.END, display)

        mode_names = {"all": "全部", "binder": "綁定人", "patient": "被綁定人", "time": "時間"}
        if mode == "time":
            filter_desc = f"（時間：{filter_time}）"
        elif show_all or not keyword:
            filter_desc = "（全部）"
        else:
            filter_desc = f"（{mode_names.get(mode, '全部')}：{keyword}）"
        self.bind_info_label.config(text=f"共 {len(records)} 筆符合 {filter_desc}")

    def do_binding_time_search(self):
        mode = self.search_mode.get()
        if mode != "time":
            return
        filter_time = self.bind_time_var.get().strip()
        if not filter_time:
            self.bind_listbox.delete(0, tk.END)
            self.bind_info_label.config(text="請輸入時間關鍵字（例如：20260705）")
            return
        self.refresh_binding_list()

    def do_binding_time_search(self):
        self.refresh_binding_list()

    def do_binding_time_search(self):
        filter_time = self.bind_search_var.get().strip()
        self.refresh_binding_list(filter_time if filter_time else None)

    def do_binder_search(self):
        if not self.records:
            messagebox.showwarning("警告", "patdb 尚未載入")
            return
        keyword = self.binder_search_var.get().strip()
        if not keyword:
            return
        results = search_records(self.records, keyword)
        self.binder_listbox.delete(0, tk.END)
        for rec in results:
            name = rec.get("NAME", "")
            idno = rec.get("ID", "")
            birth = rec.get("BIRTH", "")
            sex = rec.get("SEX", "")
            recno = rec["_recno"]
            display = f"{name} | {idno} | 生日：{birth} | 性別：{sex} | RECNO：{recno}"
            self.binder_listbox.insert(tk.END, display)
        self.binder_info_label.config(text=f"找到 {len(results)} 筆資料，請雙擊選擇")

    def clear_binder_search(self):
        self.binder_search_var.set("")
        self.binder_listbox.delete(0, tk.END)
        self.binder_info_label.config(text="（尚未選擇）")
        self.selected_binder_recno = None
        self.selected_binder_name = None
        self.selected_binder_idno = None
        self._update_confirm_button()

    def on_binder_select(self):
        sel = self.binder_listbox.curselection()
        if not sel:
            messagebox.showwarning("警告", "請先選擇一位綁定人")
            return
        idx = sel[0]
        keyword = self.binder_search_var.get().strip()
        results = search_records(self.records, keyword)
        rec = results[idx]
        self.selected_binder_recno = rec["_recno"]
        self.selected_binder_name = rec.get("NAME", "")
        self.selected_binder_idno = rec.get("ID", "")
        self.selected_binder_birth = rec.get("BIRTH", "")
        self.binder_info_label.config(text=f"已選擇：{self.selected_binder_name}（{self.selected_binder_idno} / 生日:{format_birth(self.selected_binder_birth)}）")
        self._update_confirm_button()

    def _update_confirm_button(self):
        if self.selected_binder_name and self.selected_name:
            self.confirm_btn.config(state="normal")
            self.confirm_label.config(text=f"【A】{self.selected_binder_name} 將綁定 【B】{self.selected_name}（{self.selected_recno}）")
        else:
            self.confirm_btn.config(state="disabled")
            self.confirm_label.config(text="")

    def on_unbind_select(self):
        sel = self.bind_listbox.curselection()
        if not sel:
            messagebox.showwarning("警告", "請先選擇一筆記錄")
            return
        if "UNBIND_API_KEY" not in self.config:
            messagebox.showerror("錯誤", "config.json 缺少 UNBIND_API_KEY 設定")
            return
        idx = sel[0]
        mode = self.search_mode.get()
        keyword = self.bind_search_var.get().strip() if mode != "time" else self.bind_time_var.get().strip()

        if mode == "time" and keyword:
            records = get_active_binding_records()
            records = [r for r in records if keyword in r[9]]
        elif keyword:
            records = search_binding_records(keyword, mode if mode != "all" else "all")
        else:
            records = get_active_binding_records()

        rec = records[idx]
        _, binder_name, binder_idno, binder_birth, patient_name, patient_idno, patient_birth, recno, recno_hash, binding_time, status = rec

        if not recno_hash:
            recno_hash = compute_recno_hash(str(recno), self.config.get("APP_KEY_V1", self.config.get("APP_KEY_CURRENT")))
            logging.warning(f"recno_hash 為空，自動重新計算：{recno} -> {recno_hash}")

        binder_display = f"{binder_name}(生日:{format_birth(binder_birth)}/ID:{binder_idno})" if binder_idno or binder_birth else binder_name
        patient_display = f"{patient_name}(生日:{format_birth(patient_birth)}/ID:{patient_idno})" if patient_idno or patient_birth else patient_name

        confirm = messagebox.askyesno("確認解除",
            f"確定要解除以下綁定嗎？\n\n"
            f"【A】綁定人：{binder_display}\n"
            f"【B】被綁定人：{patient_display}（RECNO：{recno}）\n"
            f"綁定時間：{binding_time}\n\n"
            f"若病人可操作，請引導其在 LINE「查詢就醫資訊」中解除。")
        if not confirm:
            return

        try:
            link_result = call_get_link_by_recno_hash(self.config["apiBaseUrl"], recno_hash, self.config["UNBIND_API_KEY"])
            if link_result.get("ok") and link_result.get("data"):
                link_id = link_result["data"]["linkId"]
                unbind_result = call_admin_unbind(self.config["apiBaseUrl"], link_id, self.config["UNBIND_API_KEY"])
                if unbind_result.get("ok"):
                    update_binding_status(recno_hash, "unbound")
                    messagebox.showinfo("成功", f"已成功解除「{binder_name}」綁定「{patient_name}」的記錄")
                    logging.info(f"解除綁定成功：{binder_name} 綁定 {patient_name} ({recno})")
                    self.refresh_binding_list()
                else:
                    messagebox.showerror("失敗", f"解除失敗：{unbind_result.get('error')}")
            elif link_result.get("data") is None:
                messagebox.showinfo("提示", "雲端無有效綁定記錄，本地記錄已移除")
                update_binding_status(recno_hash, "unbound")
                self.refresh_binding_list()
            else:
                messagebox.showerror("失敗", f"查詢失敗：{link_result.get('error')}")
        except requests.exceptions.ConnectionError:
            messagebox.showerror("連線錯誤", f"無法連線到 API 伺服器\n{self.config['apiBaseUrl']}")
            logging.error("API 連線失敗")
        except Exception as e:
            messagebox.showerror("錯誤", f"解除失敗：\n{e}")
            logging.error(f"解除綁定例外：{e}")

    def do_search(self):
        if not self.records:
            messagebox.showwarning("警告", "patdb 尚未載入")
            return
        keyword = self.search_var.get().strip()
        if not keyword:
            return
        results = search_records(self.records, keyword)
        self.result_listbox.delete(0, tk.END)
        for rec in results:
            name = rec.get("NAME", "")
            idno = rec.get("ID", "")
            birth = rec.get("BIRTH", "")
            sex = rec.get("SEX", "")
            recno = rec["_recno"]
            display = f"{name} | {idno} | 生日：{birth} | 性別：{sex} | RECNO：{recno}"
            self.result_listbox.insert(tk.END, display)
        self.info_label.config(text=f"找到 {len(results)} 筆資料，請雙擊選擇")

    def clear_search(self):
        self.search_var.set("")
        self.result_listbox.delete(0, tk.END)
        self.info_label.config(text="（尚未選擇）")
        self.code_label.config(text="（尚未產生）")
        self.expiry_label.config(text="")
        self.selected_recno = None
        self.selected_name = None
        self.selected_idno = None
        self.pending_binding_info = None
        self.confirm_line_btn.config(state="disabled", style="")
        self.line_bind_status.config(text="", foreground="gray")
        self._update_confirm_button()

    def on_select(self):
        sel = self.result_listbox.curselection()
        if not sel:
            messagebox.showwarning("警告", "請先選擇一位被綁定人")
            return
        idx = sel[0]
        keyword = self.search_var.get().strip()
        results = search_records(self.records, keyword)
        rec = results[idx]
        self.selected_recno = rec["_recno"]
        self.selected_name = rec.get("NAME", "")
        self.selected_idno = rec.get("ID", "")
        self.selected_birth = rec.get("BIRTH", "")
        self.info_label.config(text=f"已選擇：{self.selected_name}（{self.selected_idno} / 生日:{format_birth(self.selected_birth)}）")
        self._update_confirm_button()

    def on_confirm_and_generate(self):
        if not self.selected_binder_name or not self.selected_name:
            messagebox.showwarning("警告", "請先選擇綁定人和被綁定人")
            return
        if not self.selected_recno:
            messagebox.showwarning("警告", "請選擇被綁定人")
            return
        self.generate_code()

    def generate_code(self):
        if not self.selected_recno:
            return

        if not self.selected_binder_name:
            messagebox.showwarning("警告", "請先選擇綁定人")
            return

        recno_hash = compute_recno_hash(str(self.selected_recno), self.config["APP_KEY_V1"])

        if "APP_KEY_V1" in self.config:
            existing = check_existing_binding(self.selected_binder_name, recno_hash)
            if existing:
                existing_rec = existing[0]
                binder_idno = existing_rec[2] or ''
                binder_birth = existing_rec[3] or ''
                patient_idno = existing_rec[5] or ''
                patient_birth = existing_rec[6] or ''
                messagebox.showwarning("警告",
                    f"【重複綁定】\n\n"
                    f"「{self.selected_binder_name}」已經綁定過「{existing_rec[4]}(生日:{format_birth(patient_birth)}/ID:{patient_idno})」（RECNO：{existing_rec[7]}）\n"
                    f"綁定時間：{existing_rec[8]}\n\n"
                    f"請先在「綁定管理」頁面取消舊綁定，再重新產生驗證碼。")
                return

        try:
            result = call_create_verify_code(self.config["apiBaseUrl"], self.selected_recno)
            if result.get("ok"):
                data = result["data"]
                code = data["code"]
                expires = data["expiresAt"]
                dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
                local_dt = dt.astimezone().strftime("%Y-%m-%d %H:%M:%S")
                self.code_label.config(text=code)
                self.expiry_label.config(text=f"有效期至：{local_dt}（5 分鐘）")
                self.root.clipboard_clear()
                self.root.clipboard_append(code)

                if "APP_KEY_V1" in self.config:
                    self.pending_binding_info = {
                        "binder_name": self.selected_binder_name,
                        "binder_idno": self.selected_binder_idno,
                        "binder_birth": self.selected_binder_birth,
                        "patient_name": self.selected_name,
                        "patient_idno": self.selected_idno,
                        "patient_birth": self.selected_birth,
                        "recno": str(self.selected_recno),
                        "recno_hash": recno_hash,
                        "binding_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }

                logging.info(f"驗證碼產生成功：recno={self.selected_recno}, code={code}")

                if "APP_KEY_V1" in self.config and "UNBIND_API_KEY" in self.config:
                    try:
                        link_result = call_get_link_by_recno_hash(self.config["apiBaseUrl"], recno_hash, self.config["UNBIND_API_KEY"])
                        if link_result.get("ok") and link_result.get("data"):
                            if "APP_KEY_V1" in self.config:
                                save_binding_record(
                                    self.selected_binder_name,
                                    self.selected_binder_idno,
                                    self.selected_binder_birth,
                                    self.selected_name,
                                    self.selected_idno,
                                    self.selected_birth,
                                    str(self.selected_recno),
                                    recno_hash,
                                    datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                )
                            self.pending_binding_info = None
                            self.confirm_line_btn.config(state="disabled")
                            self.line_bind_status.config(text="")
                            messagebox.showinfo("成功",
                                f"LINE 已有有效綁定，本地記錄已儲存！\n\n"
                                f"「{self.selected_binder_name}」已成功綁定「{self.selected_name}」（RECNO：{self.selected_recno}）")
                            logging.info(f"LINE 已綁定，直接寫入本地記錄：{self.selected_binder_name} 綁定 {self.selected_name} ({self.selected_recno})")
                            if "APP_KEY_V1" in self.config:
                                self.refresh_binding_list()
                            return
                        elif link_result.get("data") is None:
                            pass
                        else:
                            logging.warning(f"查詢 LINE 綁定狀態失敗：{link_result.get('error')}")
                    except Exception as e:
                        logging.error(f"檢查 LINE 綁定例外：{e}")

                    self.confirm_line_btn.config(state="normal", style="ConfirmLine.TButton")
                    self.line_bind_status.config(text=f"等待 LINE 綁定確認：{self.selected_binder_name} → {self.selected_name}", foreground="red")
                    logging.info(f"確認 LINE 綁定按鈕已啟用")

                elif "APP_KEY_V1" in self.config:
                    self.confirm_line_btn.config(state="normal", style="ConfirmLine.TButton")
                    self.line_bind_status.config(text=f"等待 LINE 綁定確認：{self.selected_binder_name} → {self.selected_name}", foreground="red")
                    logging.info(f"確認 LINE 綁定按鈕已啟用（UNBIND_API_KEY 未設定）")

                self.root.update()
                messagebox.showinfo("成功",
                    f"驗證碼已產生並複製到剪貼簿\n"
                    f"代碼：{code}\n"
                    f"有效期至：{local_dt}\n\n"
                    f"請告訴「{self.selected_binder_name}」到 LINE 輸入驗證碼\n"
                    f"完成後，回來點「確認 LINE 綁定」")
            else:
                messagebox.showerror("失敗", f"API 回傳錯誤：{result}")
                logging.error(f"API 回傳失敗：{result}")
        except requests.exceptions.ConnectionError:
            messagebox.showerror("連線錯誤", f"無法連線到 API 伺服器\n{self.config['apiBaseUrl']}")
            logging.error("API 連線失敗")
        except Exception as e:
            messagebox.showerror("錯誤", f"呼叫 API 時發生錯誤：\n{e}")
            logging.error(f"呼叫 API 例外：{e}")

    def copy_code(self):
        code = self.code_label.cget("text")
        if code and code != "（尚未產生）":
            self.root.clipboard_clear()
            self.root.clipboard_append(code)
            messagebox.showinfo("已複製", "驗證碼已複製到剪貼簿")

    def confirm_line_binding(self):
        if not self.pending_binding_info:
            messagebox.showwarning("警告", "目前沒有待確認的綁定資訊")
            return
        if "UNBIND_API_KEY" not in self.config:
            messagebox.showerror("錯誤", "config.json 缺少 UNBIND_API_KEY 設定")
            return

        info = self.pending_binding_info
        recno_hash = info["recno_hash"]
        binder_name = info["binder_name"]
        patient_name = info["patient_name"]
        recno = info["recno"]

        try:
            link_result = call_get_link_by_recno_hash(self.config["apiBaseUrl"], recno_hash, self.config["UNBIND_API_KEY"])
            if link_result.get("ok") and link_result.get("data"):
                save_binding_record(
                    info["binder_name"],
                    info["binder_idno"],
                    info["binder_birth"],
                    info["patient_name"],
                    info["patient_idno"],
                    info["patient_birth"],
                    info["recno"],
                    info["recno_hash"],
                    info["binding_time"]
                )
                self.pending_binding_info = None
                self.confirm_line_btn.config(state="disabled", style="")
                self.line_bind_status.config(text="", foreground="gray")
                self.refresh_binding_list()
                messagebox.showinfo("成功",
                    f"LINE 綁定成功，本地記錄已儲存！\n\n"
                    f"「{binder_name}」已成功綁定「{patient_name}」（RECNO：{recno}）")
                logging.info(f"LINE 綁定確認成功：{binder_name} 綁定 {patient_name} ({recno})")
            elif link_result.get("data") is None:
                messagebox.showwarning("尚未完成",
                    f"LINE 尚未完成綁定\n\n"
                    f"請確認「{binder_name}」已在 LINE 中輸入驗證碼後，再點擊「確認 LINE 綁定」")
            else:
                messagebox.showerror("失敗", f"查詢失敗：{link_result.get('error')}")
        except requests.exceptions.ConnectionError:
            messagebox.showerror("連線錯誤", f"無法連線到 API 伺服器\n{self.config['apiBaseUrl']}")
        except Exception as e:
            messagebox.showerror("錯誤", f"發生錯誤：\n{e}")
            logging.error(f"確認 LINE 綁定例外：{e}")

    def run(self):
        self.root.mainloop()

def main():
    setup_logging()
    logging.info("=== 啟動 patdb_query ===")
    try:
        config = load_config()
    except FileNotFoundError as e:
        print(e)
        input("按 Enter 結束...")
        sys.exit(1)
    init_binding_db()
    app = App(config)
    app.run()

if __name__ == "__main__":
    main()