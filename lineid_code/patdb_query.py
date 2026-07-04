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
            patient_name TEXT NOT NULL,
            recno TEXT NOT NULL,
            recno_hash TEXT NOT NULL,
            binding_time TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now', '+8 hours')),
            UNIQUE(recno_hash, status)
        )
    """)
    conn.commit()
    conn.close()
    logging.info(f"本地綁定資料庫初始化完成：{BINDING_DB_PATH}")

def compute_recno_hash(recno, app_key_b64):
    key = base64.b64decode(app_key_b64)
    return hmac.new(key, recno.encode('utf-8'), hashlib.sha256).hexdigest()

def save_binding_record(patient_name, recno, recno_hash, binding_time):
    conn = sqlite3.connect(BINDING_DB_PATH)
    try:
        conn.execute("""
            INSERT INTO binding_records (patient_name, recno, recno_hash, binding_time, status)
            VALUES (?, ?, ?, ?, 'active')
        """, (patient_name, recno, recno_hash, binding_time))
        conn.commit()
        logging.info(f"本地綁定記錄寫入成功：{patient_name} ({recno})")
        return True
    except sqlite3.IntegrityError:
        conn.execute("DELETE FROM binding_records WHERE recno_hash = ?", (recno_hash,))
        conn.execute("""
            INSERT INTO binding_records (patient_name, recno, recno_hash, binding_time, status)
            VALUES (?, ?, ?, ?, 'active')
        """, (patient_name, recno, recno_hash, binding_time))
        conn.commit()
        logging.info(f"重新啟用綁定記錄：{patient_name} ({recno})")
        return True
    finally:
        conn.close()

def get_active_binding_records():
    conn = sqlite3.connect(BINDING_DB_PATH)
    rows = conn.execute("""
        SELECT id, patient_name, recno, recno_hash, binding_time, status
        FROM binding_records WHERE status = 'active' ORDER BY binding_time DESC
    """).fetchall()
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

        self.root = tk.Tk()
        self.root.title("賜安診所 - 驗證碼產生器")
        self.root.geometry("800x650")
        self.build_ui()

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
        f = ttk.Frame(parent, padding=15)
        f.pack(fill='both', expand=True)
        parent.columnconfigure(0, weight=1)
        parent.rowconfigure(0, weight=1)

        title = ttk.Label(f, text="賜安診所 LINE 綁定驗證碼系統", font=("Microsoft JhengHei", 14, "bold"))
        title.grid(row=0, column=0, columnspan=2, pady=(0, 10))

        ttk.Label(f, text="搜尋（姓名 / 身分證 / 生日）：").grid(row=1, column=0, sticky="w", pady=5)
        self.search_var = tk.StringVar()
        search_entry = ttk.Entry(f, textvariable=self.search_var, width=40, font=("Microsoft JhengHei", 12))
        search_entry.grid(row=1, column=1, pady=5)
        search_entry.bind("<Return>", lambda e: self.do_search())
        search_entry.focus()

        btn_frame = ttk.Frame(f)
        btn_frame.grid(row=2, column=0, columnspan=2, pady=5)
        ttk.Button(btn_frame, text="查詢", command=self.do_search).pack(side="left", padx=5)
        ttk.Button(btn_frame, text="清除", command=self.clear_search).pack(side="left", padx=5)

        list_frame = ttk.Frame(f)
        list_frame.grid(row=3, column=0, columnspan=2, pady=5, sticky="nsew")
        scrollbar = ttk.Scrollbar(list_frame)
        self.result_listbox = tk.Listbox(list_frame, width=70, height=10, font=("Microsoft JhengHei", 11), yscrollcommand=scrollbar.set)
        self.result_listbox.grid(row=0, column=0, sticky="nsew")
        scrollbar.config(command=self.result_listbox.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        list_frame.rowconfigure(0, weight=1)
        list_frame.columnconfigure(0, weight=1)

        self.result_listbox.bind("<Double-Button-1>", lambda e: self.on_select())

        confirm_frame = ttk.Frame(f)
        confirm_frame.grid(row=4, column=0, columnspan=2, pady=5)
        ttk.Button(confirm_frame, text="選擇此病人並產生驗證碼", command=self.on_select).pack()

        self.info_label = ttk.Label(f, text="", foreground="blue", font=("Microsoft JhengHei", 11))
        self.info_label.grid(row=5, column=0, columnspan=2, pady=5)

        code_frame = ttk.LabelFrame(f, text="驗證碼", padding=10)
        code_frame.grid(row=6, column=0, columnspan=2, pady=10, sticky="nsew")
        self.code_label = ttk.Label(code_frame, text="（尚未產生）", font=("Microsoft JhengHei", 28, "bold"), foreground="red")
        self.code_label.pack()
        self.expiry_label = ttk.Label(code_frame, text="", font=("Microsoft JhengHei", 10))
        self.expiry_label.pack()
        ttk.Button(code_frame, text="複製驗證碼", command=self.copy_code).pack(pady=5)

        self.status_label = ttk.Label(f, text="", foreground="gray")
        self.status_label.grid(row=7, column=0, columnspan=2)

        f.columnconfigure(1, weight=1)

    def build_tab2(self, parent):
        f = ttk.Frame(parent, padding=15)
        f.pack(fill='both', expand=True)
        parent.columnconfigure(0, weight=1)
        parent.rowconfigure(0, weight=1)

        title = ttk.Label(f, text="本地綁定記錄管理", font=("Microsoft JhengHei", 12, "bold"))
        title.pack(anchor='w')

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
        ttk.Button(btn_frame, text="刷新列表", command=self.refresh_binding_list).pack(side='left', padx=5)
        ttk.Button(btn_frame, text="解除綁定", command=self.on_unbind_select).pack(side='left', padx=5)

        self.bind_info_label = ttk.Label(f, text="", foreground="blue", font=("Microsoft JhengHei", 10))
        self.bind_info_label.pack(pady=5)

        guide_frame = ttk.LabelFrame(f, text="櫃台引導", padding=10)
        guide_frame.pack(fill='x', pady=10)
        ttk.Label(guide_frame, text="請病人在 LINE 的「查詢就醫資訊」中操作解除", foreground="green", font=("Microsoft JhengHei", 10)).pack(anchor='w')
        ttk.Label(guide_frame, text="若病人已無法操作LINE，可由櫃台在此輸入密碼後強制解除", foreground="red", font=("Microsoft JhengHei", 9)).pack(anchor='w')

        self.refresh_binding_list()

    def refresh_binding_list(self):
        self.bind_listbox.delete(0, tk.END)
        records = get_active_binding_records()
        for rec in records:
            _, patient_name, recno, _, binding_time, status = rec
            display = f"{patient_name} | RECNO：{recno} | 綁定時間：{binding_time} | 狀態：{status}"
            self.bind_listbox.insert(tk.END, display)
        self.bind_info_label.config(text=f"共 {len(records)} 筆有效綁定")

    def on_unbind_select(self):
        sel = self.bind_listbox.curselection()
        if not sel:
            messagebox.showwarning("警告", "請先選擇一筆記錄")
            return
        if "UNBIND_API_KEY" not in self.config:
            messagebox.showerror("錯誤", "config.json 缺少 UNBIND_API_KEY 設定")
            return
        idx = sel[0]
        records = get_active_binding_records()
        rec = records[idx]
        _, patient_name, recno, recno_hash, binding_time, status = rec

        confirm = messagebox.askyesno("確認解除", f"確定要解除「{patient_name}」的綁定嗎？\nRECNO：{recno}\n綁定時間：{binding_time}\n\n若病人可操作，請引導其在 LINE「查詢就醫資訊」中解除。")
        if not confirm:
            return

        try:
            link_result = call_get_link_by_recno_hash(self.config["apiBaseUrl"], recno_hash, self.config["UNBIND_API_KEY"])
            if link_result.get("ok") and link_result.get("data"):
                link_id = link_result["data"]["linkId"]
                unbind_result = call_admin_unbind(self.config["apiBaseUrl"], link_id, self.config["UNBIND_API_KEY"])
                if unbind_result.get("ok"):
                    update_binding_status(recno_hash, "unbound")
                    messagebox.showinfo("成功", f"已成功解除「{patient_name}」的綁定")
                    logging.info(f"解除綁定成功：{patient_name} ({recno})")
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
        self.info_label.config(text="")
        self.code_label.config(text="（尚未產生）")
        self.expiry_label.config(text="")
        self.selected_recno = None

    def on_select(self):
        sel = self.result_listbox.curselection()
        if not sel:
            messagebox.showwarning("警告", "請先選擇一位病人")
            return
        idx = sel[0]
        keyword = self.search_var.get().strip()
        results = search_records(self.records, keyword)
        rec = results[idx]
        self.selected_recno = rec["_recno"]
        self.selected_name = rec.get("NAME", "")
        self.selected_idno = rec.get("ID", "")
        self.info_label.config(text=f"已選擇：{self.selected_name}（{self.selected_idno}）")
        self.generate_code()

    def generate_code(self):
        if not self.selected_recno:
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
                    recno_hash = compute_recno_hash(str(self.selected_recno), self.config["APP_KEY_V1"])
                    save_binding_record(self.selected_name, str(self.selected_recno), recno_hash, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                    self.refresh_binding_list()
                    logging.info(f"本地綁定記錄已寫入：{self.selected_name} ({self.selected_recno})")

                logging.info(f"驗證碼產生成功：recno={self.selected_recno}, code={code}")
                messagebox.showinfo("成功", f"驗證碼已產生並複製到剪貼簿\n代碼：{code}\n有效期至：{local_dt}")
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