#!/usr/bin/env python3
"""
看診進度上傳腳本
功能：讀取 TEMP_NOW.DBF，定時上傳到 Supabase queue_status 資料表
排程：每 5 分鐘執行一次

使用方式：
  pip install dbfread supabase
  python dbf_to_supabase.py --path "G:\rs\S\TEMP_NOW.DBF"

自動輪詢模式（每 5 分鐘）：
  python dbf_to_supabase.py --path "G:\rs\S\TEMP_NOW.DBF" --interval 300
"""

import argparse
import os
import time
from datetime import datetime
from supabase import create_client, Client
from dbfread import DBF

SUPABASE_URL = "https://kbpyxboleoefwvdnjcod.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NjYyNCwiZXhwIjoyMDk3NDQyNjI0fQ.KS0GG_in6M6ZMr02WRhXx8L3URpnW2xgKdu5W7KIfa8"

DEFAULT_DBF_PATH = r"G:\rs\S\TEMP_NOW.DBF"

def parse_roc_date(date_str):
    """將民國年日期轉換為 Python datetime"""
    s = str(date_str).strip()
    try:
        if " " in s:
            date_part, time_part = s.split(" ", 1)
        else:
            date_part, time_part = s, "00:00:00"

        if len(date_part) == 7:
            year = int(date_part[:3]) + 1911
            month = int(date_part[3:5])
            day = int(date_part[5:7])
        else:
            return None

        time_parts = time_part.split(":")
        hour = int(time_parts[0]) if len(time_parts) > 0 else 0
        minute = int(time_parts[1]) if len(time_parts) > 1 else 0
        second = int(time_parts[2]) if len(time_parts) > 2 else 0
        return datetime(year, month, day, hour, minute, second)
    except (ValueError, IndexError):
        return None

def infer_shift_type(dt):
    """根據小時推斷午別"""
    if dt:
        h = dt.hour
        if h < 12:
            return "早診"
        elif h < 18:
            return "午診"
        else:
            return "晚診"
    return "早診"

def upload_record(supabase, record, max_retries=3):
    """上傳一筆資料（更新或新增），失敗重試"""
    room = record["room"]
    date = record["date"]

    for attempt in range(max_retries):
        try:
            existing = supabase.table("queue_status").select("id").eq("room", room).eq("date", date).execute()

            if existing.data:
                supabase.table("queue_status").update(record).eq("id", existing.data[0]["id"]).execute()
                print(f"  更新：看診號={record['current_number']}, 等候={record['wait_count']}, 醫師={record['doctor_name']}")
            else:
                result = supabase.table("queue_status").insert(record).execute()
                print(f"  新增：看診號={record['current_number']}, 等候={record['wait_count']}, 醫師={record['doctor_name']}")
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  上傳失敗（第 {attempt+1} 次）：{e}，2 秒後重試...")
                time.sleep(2)
            else:
                print(f"  上傳失敗（已達最大重試次數）：{e}")
                return False

def read_dbf(dbf_path, max_retries=3):
    """讀取 TEMP_NOW.DBF 並轉換為上傳格式（失敗重試）"""
    if not os.path.exists(dbf_path):
        print(f"找不到檔案：{dbf_path}")
        return []

    for attempt in range(max_retries):
        try:
            print(f"讀取：{dbf_path}")
            records = []
            for row in DBF(dbf_path, encoding="big5"):
                date_val = row.get("DATE", "")
                date_time_val = row.get("DATE_TIME", "")
                now_ser = row.get("NOW_SER", 0) or 0
                temp_recno = row.get("TEMP_RECNO", 0) or 0
                current_number = now_ser if now_ser > 0 else temp_recno
                wait_count = row.get("WAIT_COUNT", 0) or 0
                doctor_name = row.get("DOCTOR", "")
                dt = parse_roc_date(str(date_time_val))

                rec = {
                    "date": int(date_val) if date_val else 0,
                    "room": int(row.get("ROOM", 1) or 1),
                    "roomn": str(row.get("ROOMN", "")).strip(),
                    "current_number": int(current_number),
                    "wait_count": int(wait_count),
                    "doctor_name": str(doctor_name).strip(),
                    "shift_type": infer_shift_type(dt),
                    "last_updated": dt
                }
                records.append(rec)
            return records
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"  讀取失敗（第 {attempt+1} 次）：{e}，1 秒後重試...")
                time.sleep(1)
            else:
                print(f"  讀取失敗（已達最大重試次數）：{e}")
                return []

def main():
    parser = argparse.ArgumentParser(description="看診進度上傳至 Supabase")
    parser.add_argument("--path", default=DEFAULT_DBF_PATH, help="TEMP_NOW.DBF 路徑")
    parser.add_argument("--interval", type=int, default=0, help="輪詢間隔秒數（0=單次執行）")
    args = parser.parse_args()

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    if args.interval > 0:
        print(f"啟動輪詢模式，間隔 {args.interval} 秒（Ctrl+C 結束）")
        while True:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 檢查資料...")
            records = read_dbf(args.path)
            if records:
                for rec in records:
                    upload_record(supabase, rec)
            else:
                print("  無資料")
            time.sleep(args.interval)
    else:
        records = read_dbf(args.path)
        for rec in records:
            upload_record(supabase, rec)

if __name__ == "__main__":
    main()