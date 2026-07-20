"""
慢性病處方箋同步腳本
每 7 天執行一次，將 slow_rec.dbf 的最近 90 天記錄同步到 Supabase chronic_prescriptions_date 表

使用方式：
    python sync_chronic.py

排程設定（Windows Task Scheduler）：
    - 執行頻率：每 7 天
    - 執行程式：python
    - 引數：H:\opencode\linebot\lineid_code\Medication_Reminder\sync_chronic.py
"""

import os
import sys
import logging
from datetime import datetime, timedelta
from dbfread import DBF, FieldParser

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("sync_chronic.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)

SUPABASE_URL = "https://kbpyxboleoefwvdnjcod.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImltMCI6MTc0MDU1NDQwMH0.H9nJJPgYbBbKqxfLSRjSRxqs1eLq0c1h4E9xOQO1R0w"


class RawFieldParser(FieldParser):
    def parseC(self, field, data):
        if isinstance(data, bytes):
            return data.decode('latin-1').rstrip('\x00 ')
        return data


def dbf_date_to_roc(dbf_str):
    """將 DBF 日期（如 B50701）轉換為 ROC 日期字串（如 1150701），去掉 A/B"""
    if not dbf_str or len(dbf_str) < 5:
        return dbf_str
    try:
        prefix = dbf_str[0].upper()
        year_digit = int(dbf_str[1])
        rest = dbf_str[2:]  # MMDD
        # A=10, B=11 → ROC year = prefix_value * 10 + year_digit
        prefix_value = 10 if prefix == 'A' else 11
        roc_year = prefix_value * 10 + year_digit
        return f"{roc_year}{rest}"
    except:
        return dbf_str


def dbf_roc_to_date(dbf_str):
    """將 DBF 原始日期（如 B50701）轉換為 datetime
    
    格式：A5=105年, B5=115年（prefix + year_digit + MMDD）
    """
    if not dbf_str or len(dbf_str) < 5:
        return None
    try:
        prefix = dbf_str[0].upper()
        year_digit = int(dbf_str[1])
        month = int(dbf_str[2:4])
        day = int(dbf_str[4:6])
        year = (10 if prefix == 'A' else 11) * 10 + year_digit
        return datetime(year + 1911, month, day)
    except:
        return None


def roc_to_date(roc_str):
    """將 ROC 日期字串（如 1150701）轉換為 datetime
    
    支援 7 位數 (1150701) 或 6 位數 (1050701)
    """
    if not roc_str or len(roc_str) < 5:
        return None
    try:
        # 支援 7 位數 (1150701) 或 6 位數 (1050701)
        roc_year = int(roc_str[:3]) if len(roc_str) >= 7 else int(roc_str[:2])
        month = int(roc_str[-4:-2])
        day = int(roc_str[-2:])
        return datetime(roc_year + 1911, month, day)
    except:
        return None


def date_to_roc(date_obj):
    """將西元 date 物件轉換為 ROC 日期字串（如 1150928），去掉 A/B"""
    if not date_obj:
        return None
    roc_year = date_obj.year - 1911
    return f"{roc_year}{date_obj.month:02d}{date_obj.day:02d}"


def mask_recno(recno):
    """病歷號去識別化：0*****7"""
    if not recno or len(recno) < 3:
        return recno
    return f"{recno[0]}*****{recno[-1]}"


def days_between(start_date, end_date):
    """計算兩個 date 之間的天數"""
    if not start_date or not end_date:
        return None
    return (end_date - start_date).days


def load_config():
    """讀取設定檔"""
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"找不到設定檔：{config_path}")
    with open(config_path, encoding="utf-8") as f:
        import json
        return json.load(f)


def sync_chronic_prescriptions(slow_rec_path, supabase_url, supabase_key):
    """
    主要同步邏輯

    1. 讀取 slow_rec.dbf 最近 90 天內所有記錄
    2. 依 CODE 分組，取 DATE 最大的（目前在效期內的慢連箋）
    3. 計算各次領藥日期、過期日
    4. Upsert 到 Supabase
    """
    import requests

    logging.info(f"正在讀取：{slow_rec_path}")
    db = DBF(slow_rec_path, load=True, parserclass=RawFieldParser)
    records = list(db)
    logging.info(f"共載入 {len(records)} 筆記錄")

    ninety_days_ago = datetime.now() - timedelta(days=90)

    # 步驟1：過濾近 90 天記錄
    filtered = []
    for rec in records:
        s_date = dbf_roc_to_date(rec.get('S_DATE', ''))
        if s_date and s_date >= ninety_days_ago:
            filtered.append(rec)

    logging.info(f"近 90 天記錄：{len(filtered)} 筆")

    # 步驟2：依 CODE 分組，取 DATE 最大的
    from collections import defaultdict
    code_groups = defaultdict(list)
    for rec in filtered:
        code = str(rec.get('CODE', '')).strip()
        date_val = rec.get('DATE', '')
        if code:
            code_groups[code].append(rec)

    # 步驟3：對每個 CODE 取 DATE 最大的群組
    result = {}
    for code, recs in code_groups.items():
        # 取 DATE 最大的
        latest = max(recs, key=lambda r: dbf_roc_to_date(r.get('DATE', '')) or datetime.min)
        date_val = latest.get('DATE', '')
        first_date_roc = dbf_date_to_roc(date_val)

        # 從該群組取出各次領藥日期
        serno_dates = {}
        for r in recs:
            if r.get('DATE', '') == date_val:
                serno = int(r.get('S_SERNO', 0))
                if serno in (1, 2, 3):
                    serno_dates[serno] = dbf_date_to_roc(r.get('S_DATE', ''))

        # 計算過期日（第 1 次領藥日 + total_days - 1）
        total_days = int(latest.get('S_DAYS', 90))
        per_days = int(latest.get('DAYS', 30))
        serno1 = serno_dates.get(1)
        expire_date = None
        if serno1:
            serno1_date = roc_to_date(serno1)
            if serno1_date:
                expire_date = date_to_roc(serno1_date + timedelta(days=total_days - 1))

        result[code] = {
            'code': code,
            'first_date': first_date_roc,
            'total_days': total_days,
            'per_days': per_days,
            'serno1_date': serno_dates.get(1),
            'serno2_date': serno_dates.get(2),
            'serno3_date': serno_dates.get(3),
            'expire_date': expire_date,
        }

    logging.info(f"有效慢連箋（近90天）：{len(result)} 筆")

    # 步驟4：Upsert 到 Supabase
    upsert_count = 0
    for code, data in result.items():
        payload = {
            'p_code': data['code'],
            'p_first_date': data['first_date'],
            'p_total_days': data['total_days'],
            'p_per_days': data['per_days'],
            'p_serno1_date': data['serno1_date'] or None,
            'p_serno2_date': data['serno2_date'] or None,
            'p_serno3_date': data['serno3_date'] or None,
            'p_expire_date': data['expire_date'] or '',
        }

        resp = requests.post(
            f"{supabase_url}/rest/v1/rpc/chronic_prescriptions_date_upsert",
            json=payload,
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            timeout=10
        )
        if resp.status_code in (200, 201, 204):
            upsert_count += 1
        else:
            logging.warning(f"Upsert 失敗 code={code}: {resp.status_code} {resp.text}")

    logging.info(f"同步完成：{upsert_count} 筆記錄")

    # 印出摘要
    print("\n=== 同步摘要 ===")
    print(f"慢連箋記錄總數：{len(records)}")
    print(f"近90天記錄：{len(filtered)}")
    print(f"有效慢連箋：{len(result)}")
    print(f"已同步：{upsert_count}")

    return result


def main():
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")

    if os.path.exists(config_path):
        with open(config_path, encoding="utf-8") as f:
            import json
            config = json.load(f)
        slow_rec_path = config.get("slowRecPath", "H:/clinic_file/slow_rec.dbf")
        supabase_url = config.get("supabaseUrl", SUPABASE_URL)
        supabase_key = config.get("supabaseKey", SUPABASE_SERVICE_KEY)
    else:
        logging.info("找不到 config.json，使用預設值")
        slow_rec_path = "H:/clinic_file/slow_rec.dbf"
        supabase_url = SUPABASE_URL
        supabase_key = SUPABASE_SERVICE_KEY

    logging.info("=== 慢性病處方箋同步開始 ===")
    sync_chronic_prescriptions(slow_rec_path, supabase_url, supabase_key)
    logging.info("=== 同步完成 ===")


if __name__ == "__main__":
    main()