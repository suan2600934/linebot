#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_verify_api.py
測試 LINE 帳號綁定系統 (V1 MVP) 的三支 API:
  - /api/create-verify-code
  - /api/verify
  - /api/cleanup

使用方式:
  pip install requests
  export BASE_URL="https://your-service.zeabur.app"
  export CLEANUP_API_KEY="與服務端 CLEANUP_API_KEY 相同的值"
  python3 test_verify_api.py

注意:
  這支腳本會對「真實部署的服務」打 API,請務必用測試用的 recno
  (例如 TEST-xxxx),不要用正式會員編號,以免污染正式資料。
"""

import os
import sys
import time
import uuid
import requests

BASE_URL = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/")
CLEANUP_API_KEY = os.environ.get("CLEANUP_API_KEY", "")
TIMEOUT = 10

PASS = 0
FAIL = 0


def log(label, ok, detail=""):
    global PASS, FAIL
    mark = "✅ PASS" if ok else "❌ FAIL"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"{mark} | {label} {('- ' + detail) if detail else ''}")


def post(path, json=None, headers=None):
    url = f"{BASE_URL}{path}"
    try:
        resp = requests.post(url, json=json, headers=headers, timeout=TIMEOUT)
        return resp
    except requests.RequestException as e:
        print(f"  [錯誤] 呼叫 {url} 失敗: {e}")
        return None


def gen_test_recno():
    # 用 TEST- 前綴 + uuid 確保每次跑測試都用全新的 recno,不互相干擾
    return f"TEST-{uuid.uuid4().hex[:10]}"


def create_verify_code(recno):
    resp = post("/api/create-verify-code", json={"recno": recno})
    return resp


def verify(code, line_user_id):
    resp = post("/api/verify", json={"code": code, "lineUserId": line_user_id})
    return resp


def cleanup(api_key=None):
    headers = {}
    if api_key:
        headers["x-cleanup-api-key"] = api_key
    resp = post("/api/cleanup", headers=headers)
    return resp


# ----------------------------------------------------------------
# 測試案例
# ----------------------------------------------------------------

def test_create_verify_code():
    print("\n--- 測試 1: /api/create-verify-code 基本建立 ---")
    recno = gen_test_recno()
    resp = create_verify_code(recno)

    if resp is None:
        log("建立驗證碼", False, "連線失敗")
        return None, None

    ok = resp.status_code == 201
    log("HTTP status 應為 201", ok, f"實際: {resp.status_code}")

    try:
        body = resp.json()
    except ValueError:
        log("回應應為合法 JSON", False, resp.text[:200])
        return None, None

    data = body.get("data", {})
    code = data.get("code")
    code_ok = bool(code) and len(code) == 6 and code.isdigit()
    log("回傳的 code 應為 6 位數字", code_ok, f"實際: {code}")

    return recno, code


def test_verify_success(recno, code):
    print("\n--- 測試 2: /api/verify 正確驗證碼應成功 ---")
    line_user_id = f"U_test_{uuid.uuid4().hex[:8]}"
    resp = verify(code, line_user_id)

    if resp is None:
        log("驗證成功流程", False, "連線失敗")
        return line_user_id

    ok = resp.status_code == 200
    log("HTTP status 應為 200", ok, f"實際: {resp.status_code} / {resp.text[:200]}")

    if ok:
        body = resp.json()
        link_id_ok = body.get("ok") is True and body.get("data", {}).get("linkId")
        log("回應應包含 linkId", bool(link_id_ok), str(body))

    return line_user_id


def test_verify_idempotent(recno, code, line_user_id):
    print("\n--- 測試 3: 同一組已成功綁定後,重複驗證同碼應失敗(碼已被標記 used) ---")
    resp = verify(code, line_user_id)

    if resp is None:
        log("重複驗證已使用碼", False, "連線失敗")
        return

    # 因為驗證碼已經是 used 狀態,理論上會查不到 pending 紀錄
    ok = resp.status_code == 400
    log("已使用過的碼,再次驗證應回 400(查無有效驗證碼)", ok, f"實際: {resp.status_code} / {resp.text[:200]}")


def test_verify_wrong_code_lockout():
    print("\n--- 測試 4: 連續輸入錯誤驗證碼,應在第 3 次後被鎖定 ---")
    recno, real_code = test_create_verify_code()
    if not recno or not real_code:
        log("建立測試用驗證碼", False, "前置作業失敗,略過此測試")
        return

    line_user_id = f"U_test_{uuid.uuid4().hex[:8]}"
    # 製造一個確定錯誤、且不等於正確碼的 6 位數字
    wrong_code = "000000" if real_code != "000000" else "111111"

    expected_remaining = [2, 1]  # 第1次錯誤剩2次,第2次錯誤剩1次
    for i, expected in enumerate(expected_remaining, start=1):
        resp = verify(wrong_code, line_user_id)
        if resp is None:
            log(f"第 {i} 次錯誤嘗試", False, "連線失敗")
            continue
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        remaining = body.get("remainingAttempts")
        ok = resp.status_code == 400 and remaining == expected
        log(f"第 {i} 次錯誤嘗試,剩餘次數應為 {expected}", ok, f"實際: {resp.status_code}, remaining={remaining}")

    # 第 3 次錯誤,應觸發鎖定(status -> failed)
    resp = verify(wrong_code, line_user_id)
    if resp is None:
        log("第 3 次錯誤嘗試(應觸發鎖定)", False, "連線失敗")
    else:
        body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        ok = resp.status_code == 400 and "錯誤次數過多" in body.get("error", "")
        log("第 3 次錯誤後應回報「錯誤次數過多」", ok, f"實際: {body}")

    # 鎖定後,即使輸入正確的碼,也應該驗證失敗(因為已被標記 failed,查無 pending)
    resp = verify(real_code, line_user_id)
    if resp is None:
        log("鎖定後用正確碼驗證,仍應失敗", False, "連線失敗")
    else:
        ok = resp.status_code == 400
        log("鎖定後即使用正確碼,也應驗證失敗", ok, f"實際: {resp.status_code} / {resp.text[:200]}")


def test_unknown_recno():
    print("\n--- 測試 5: 從未申請過驗證碼的 recno,驗證應直接失敗(找不到) ---")
    recno = gen_test_recno()
    resp = verify("123456", f"U_test_{uuid.uuid4().hex[:8]}")
    if resp is None:
        log("未知 recno 驗證", False, "連線失敗")
        return
    ok = resp.status_code == 400 and "找不到" in resp.json().get("error", "")
    log("未知 recno 應回報「找不到有效的驗證碼」", ok, f"實際: {resp.status_code} / {resp.text[:200]}")


def test_cleanup_auth():
    print("\n--- 測試 6: /api/cleanup 授權檢查 ---")

    resp = cleanup(api_key=None)
    if resp is None:
        log("未帶 key 呼叫 cleanup", False, "連線失敗")
    else:
        ok = resp.status_code == 401
        log("未帶授權 key 應回 401", ok, f"實際: {resp.status_code}")

    resp = cleanup(api_key="this-is-definitely-wrong-key")
    if resp is None:
        log("帶錯誤 key 呼叫 cleanup", False, "連線失敗")
    else:
        ok = resp.status_code == 401
        log("帶錯誤授權 key 應回 401", ok, f"實際: {resp.status_code}")

    if not CLEANUP_API_KEY:
        print("  [略過] 未設定環境變數 CLEANUP_API_KEY,略過正確授權測試")
        return

    resp = cleanup(api_key=CLEANUP_API_KEY)
    if resp is None:
        log("帶正確 key 呼叫 cleanup", False, "連線失敗")
    else:
        ok = resp.status_code == 200
        log("帶正確授權 key 應回 200", ok, f"實際: {resp.status_code} / {resp.text[:200]}")


def main():
    print(f"目標服務: {BASE_URL}")
    print("=" * 60)

    recno, code = test_create_verify_code()
    if recno and code:
        line_user_id = test_verify_success(recno, code)
        time.sleep(0.3)  # 留一點時間避免極端 race condition 干擾觀察
        test_verify_idempotent(recno, code, line_user_id)

    test_verify_wrong_code_lockout()
    test_unknown_recno()
    test_cleanup_auth()

    print("\n" + "=" * 60)
    print(f"測試結果: {PASS} 通過 / {FAIL} 失敗")
    sys.exit(1 if FAIL > 0 else 0)


if __name__ == "__main__":
    main()
