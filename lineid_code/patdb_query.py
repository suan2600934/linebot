import tkinter as tk
from tkinter import ttk, messagebox
import requests
import json
import os
import sys
import logging
from datetime import datetime
from dbfread import DBF

CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")

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

def load_patdb(path):
    logging.info(f"正在讀取 patdb：{path}")
    records = []
    for idx, record in enumerate(DBF(path, load=True, encoding="cp950", char_decode_errors="replace"), start=1):
        record["_recno"] = idx
        records.append(record)
    logging.info(f"共載入 {len(records)} 筆資料")
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

class App:
    def __init__(self, config):
        self.config = config
        self.records = None
        self.selected_recno = None

        self.root = tk.Tk()
        self.root.title("賜安診所 - 驗證碼產生器")
        self.root.resizable(False, False)
        self.build_ui()

        self.load_data()

    def load_data(self):
        try:
            patdb_path = self.config["patdbPath"]
            if not os.path.exists(patdb_path):
                messagebox.showerror("錯誤", f"patdb 檔案不存在：\n{patdb_path}")
                logging.error(f"patdb 檔案不存在：{patdb_path}")
                return
            self.records = load_patdb(patdb_path)
            self.status_label.config(text=f"已載入 {len(self.records)} 筆資料")
            logging.info("patdb 載入成功")
        except Exception as e:
            messagebox.showerror("錯誤", f"載入 patdb 失敗：\n{e}")
            logging.error(f"載入 patdb 失敗：{e}")

    def build_ui(self):
        f = ttk.Frame(self.root, padding=15)
        f.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

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
        self.result_listbox = tk.Listbox(list_frame, width=70, height=12, font=("Microsoft JhengHei", 11), yscrollcommand=scrollbar.set)
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
        name = rec.get("NAME", "")
        idno = rec.get("ID", "")
        self.info_label.config(text=f"已選擇：{name}（{idno}）")
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
    app = App(config)
    app.run()

if __name__ == "__main__":
    main()