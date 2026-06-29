# LINE Bot 醫療資訊系統 - 專案進度記錄

## 📋 專案概述

**專案名稱**：LINE Bot 醫療資訊系統（藥局/診所查詢）
**Bot 名稱**：suanclinic_aibot（賜安診所官方帳號）
**技術棧**：Node.js + Express + @line/bot-sdk + Supabase + Zeabur
**資料庫**：Supabase（PostgreSQL）

---

## ✅ 已完成的工作

### 核心功能
- [x] LINE Bot Webhook + 簽章驗證
- [x] Rich Menu 六按鈕（診所資訊、醫師介紹、門診表、分享LINE、預防保健、兒童疫苗）
- [x] NVIDIA NIM AI 對話（自帶知識庫）
- [x] Supabase 動態讀取（診所資訊、醫師介紹、健康檢查、兒童疫苗、營業時間）
- [x] 本週門診表動態計算（根據實際日期顯示對應週圖）
- [x] 看診進度查詢（queue_status 表 + getQueueStatus）

### 資料管理
- [x] Supabase 資料表：clinics, doctors, services, pharmacies, schedules, queue_status, knowledge_base
- [x] knowledge-base.md 本機留存（備份用）→ Supabase knowledge_base 表同步
- [x] AI 知識庫從 Supabase 即時讀取
- [x] `syncKnowledgeBase()` 函式（將 md 內容寫入 Supabase）

### 部署架構
- [x] Zeabur 部署（正式環境）
- [x] GitHub 倉庫備份（suan2600934/linebot）
- [x] Supabase Storage 圖床（班表圖、健康檢查圖、兒童疫苗圖）
- [x] Rich Menu 設定完成

---

## 📊 資料管理架構

| 功能 | 資料來源 | 更新方式 |
|------|----------|----------|
| LINE 回覆按鈕（診所資訊、營業時間等） | Supabase 結構表 | 更新 Supabase 即可 |
| 醫師介紹 | Supabase doctors 表 | 更新 Supabase 即可 |
| 健康檢查/兒童疫苗 | Supabase services 表 | 更新 Supabase 即可 |
| AI 知識庫 | Supabase knowledge_base 表 | 編輯 md → 叫我 sync |
| 班表圖片 | Supabase Storage | 上傳圖片即可 |

### AI 知識庫更新流程
```
編輯 knowledge-base.md → 告訴我「幫我同步知識庫」
→ 我執行 syncKnowledgeBase() → Supabase 即時更新
```

---

## 📝 待辦事項

### 優先級 1：穩定性監控
- [ ] 確認 Zeabur 正式環境所有功能正常
- [ ] 確認 Supabase 各表資料正確

### 優先級 2：即時看診進度（需診所電腦配合）
- [ ] 設定 Python 排程（每 5 分鐘上傳 TEMP_NOW.DBF）
- [ ] 安裝 Python 依賴：`pip install dbfread supabase`
- [ ] 測試上傳腳本

### 優先級 3：Rich Menu 維護
- [ ] 每月月底更新班表圖片後，重新上傳並設定為預設選單
- [ ] 考慮自動化 Rich Menu 更新腳本

### 優先級 4：Facebook 自動上傳
- [ ] Token 重新申請（目前過期，手動上傳中）

---

## 🔧 技術細節

### 環境變數（.env）
```env
LINE_CHANNEL_SECRET=545e896c26589cdbc6ad52721cff6c6c
LINE_CHANNEL_ACCESS_TOKEN=BNCxP6KMC+9Ak7IoTUxRoLebxYUSpsf7CksgxqXvmwn...
PORT=3000

# NVIDIA NIM AI
NIM_API_URL=https://integrate.api.nvidia.com/v1
NIM_API_KEY=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
NIM_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1

# Supabase
SUPABASE_URL=https://kbpyxboleoefwvdnjcod.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
```

### 服務網址
- **LINE Webhook**: `https://suanclinic.zeabur.app/webhook`
- **LINE Bot**: suanclinic_aibot（賜安診所官方帳號）
- **LINE ID**: @334snxnh
- **Facebook**: https://www.facebook.com/suanclinic?locale=zh_TW

### 啟動指令
```bash
# 開發模式
npm run dev

# 正式模式
npm start

# 同步知識庫到 Supabase
node -e "require('./index.js'); syncKnowledgeBase()"
```

---

## 📅 2026-06-27 工作進度

### ✅ LINE 帳號綁定系統（lineid_code/）

#### 啟動新子專案
- `lineid_code/`：LINE 帳號綁定功能，獨立於 LINE Bot 主程式
- 規格文件：`LINE_BINDING_IMPL.md`（v1.4）

#### Schema 設計（v1.4）
| 資料表 | 用途 |
|--------|------|
| `verification_codes` | 5 分鐘有效驗證碼（code_hash / recno_encrypted / recno_hash / key_version） |
| `line_user_links` | 正式綁定（encrypted_line_id / encrypted_recno / user_id_hash / recno_hash / key_version） |
| `line_user_links_history` | 綁定/解綁時間軸（稽核用） |
| `verification_codes_archive` | 30 天前記錄歸檔 |

#### 加密設計
- **HMAC-SHA256**：code_hash / recno_hash / user_id_hash（不可逆，防彩虹表）
- **AES-256-GCM**：recno_encrypted / encrypted_line_id / encrypted_recno（可逆）
- **SHA256**：一般性雜湊（內容指紋）
- **金鑰輪替**：APP_KEY_V1 / APP_KEY_V2 + APP_KEY_CURRENT_VERSION

#### crypto-utils.js 完成
- `HMAC-SHA256`：hmacSha256() + verifyHash()（timingSafeEqual）
- `AES-256-GCM`：encrypt() + decrypt()（格式：iv:authTag:ciphertext，base64）
- `SHA256`：sha256()
- 金鑰從環境變數動態載入（base64 32 bytes）
- 單元測試 **36/36 全部通過**

#### 待實作
- [ ] 部署 Zeabur 並設定環境變數後，執行 `test_verify_api.py` 驗證三支 API

### ✅ 三支 API 完成（index.js）
- `POST /api/create-verify-code`：傳入 recno，產生 6 位驗證碼，回傳明文 code（供 LINE/SMS 推播用）
- `POST /api/verify`：傳入 recno + code + lineUserId，驗證成功後寫入 line_user_links + history
- `POST /api/cleanup`：排程呼叫（x-cleanup-api-key 授權），搬移過期驗證碼至 archive

### ✅ API 整合測試腳本
- `test_verify_api.py`：6 個測試情境，覆蓋建立/驗證/鎖定/清理等流程

### Git 進度
- `line-binding` 分支已 commit：LINE 帳號綁定系統 MVP（10 個檔案）
- `.gitignore` 已設定，排除 patdb.dbf / patdb.docx 等敏感資料
- `patdb.dbf` / `patdb.docx` 未 commit，留在本機

### ✅ 每週班表圖自動產生腳本
- 新增 `generate-weekly-schedules.js`
- 讀取 `knowledge-base.md` 中的 Tab 格式班表
- 自動產生 `schedule-week1.png` ~ `schedule-week5.png`
- 醫師姓名顏色：周=藍色、鄭=紅色、石=綠色

### 班表圖片尺寸標準化
- `schedule-full-month.jpg`：1200 x 1193
- `schedule-week1~5.png`：1050 x 360

---

## 📅 2026-06-22 工作進度

### ✅ 動態本週門診表
- `getThisWeekSchedule()` 和 `getSchedule()` 從寫死改為動態計算
- 根據實際日期顯示對應週圖（schedule-week1~5.png）
- 週範圍文字自動更新（例如 6/22-6/28）

### ✅ Supabase 動態讀取優化（優先級 5 完成）
四個函式全面改為從 Supabase 結構表讀取：
- `getClinicPharmacyInfo()` → clinics + pharmacies 表
- `getHoursInfo()` → clinics 表
- `getHealthExam()` → services 表（category=預防保健）
- `getChildVaccine()` → services 表（category=兒童健康/疫苗）

### ✅ AI 知識庫重構
- `knowledge_base` 表格建立（TEXT 欄位存完整 markdown）
- `loadKnowledgeBase()` 改為從 Supabase 即時讀取
- `syncKnowledgeBase()` 新增（將 md 檔寫入 Supabase）
- knowledge-base.md 本機留存當備份

### 📝 知識庫同步流程
- 編輯本機 `knowledge-base.md` → 告訴我「sync」→ 我執行 `syncKnowledgeBase()` 寫入 Supabase
- AI 回覆時從 Supabase 讀取，無需網路請求外部檔案

---

### 班表圖片產生流程
```
Excel 班表
    ↓
generate-schedule-image.ps1 → schedule-full-month.jpg + knowledge-base.md
    ↓
（手動檢查/編輯 knowledge-base.md 中的 Tab 格式班表）
    ↓
node generate-weekly-schedules.js → schedule-week1~5.png
    ↓
上傳到 Supabase Storage
```

### 醫師姓名顏色
| 醫師 | 顏色 |
|------|------|
| 周 | 藍色 `#0066cc` |
| 鄭 | 紅色 `#cc0000` |
| 石 | 綠色 `#008800` |

### 班表圖片尺寸
| 檔案 | 尺寸 |
|------|------|
| `schedule-full-month.jpg` | 1200 x 1193 |
| `schedule-week1~5.png` | 1050 x 360 |

---

## 🔙 災難復原參考

### Git 復原點（出事時可執行）

| 目的 | Commit | 指令 |
|------|--------|------|
| 回復到「無 line-binding 功能」的乾淨狀態 | `2850ab9` | `git reset --hard 2850ab9` |
| 回復到 line-binding 實驗開始前 | `2850ab9` | 同上 |
| 回復到「取消綁定功能實作前」 | `1bb6baa` | `git reset --hard 1bb6baa` |
| 目前完整備份 | `1bb6baa` | `backup-before-new-changes` 分支 |

### 備份分支
```bash
# 備份分支（指向目前最新狀態）
backup-before-new-changes = 1bb6baa

# 如需更新備份分支到其他時間點：
git branch -f backup-before-new-changes <commit-hash>
```

### 完整移除 line-binding 流程
```bash
# 1. 確認要回复的 commit（通常是 2850ab9）
git reset --hard 2850ab9

# 2. 強制推送到 remote（會覆蓋 GitHub 上的歷史）
git push --force origin master

# 3. 刪除 line-binding 分支（如需要）
git branch -d line-binding
git push origin --delete line-binding
```

### 重要的 Commit 記錄
| Commit | 說明 |
|--------|------|
| `2850ab9` | line-binding 實驗開始前的乾淨狀態（無綁定功能） |
| `73eda7e` | line-binding 和 master 最後共用的 commit |
| `1bb6baa` | 目前 master 最新（取消綁定功能實作完成） |

---

**最後更新**：2026-06-29
**狀態**：LINE 取消綁定功能實作完成，準備部署測試

---

## 📅 歷史記錄（2026-06-13 ~ 2026-06-21）

### 2026-06-21
- GitHub 倉庫建立
- Zeabur 部署完成，LINE Bot 正式上線
- Webhook URL: https://suanclinic.zeabur.app/webhook

### 2026-06-20
- Supabase 資料庫串接完成
- 醫師介紹動態化（doctors 表）
- Supabase Storage 圖床設定

### 2026-06-19
- Rich Menu 六按鈕上線
- 排班系統全自動化（generate-schedule-image.ps1）
- NVIDIA NIM AI 串接完成

### 2026-06-17
- Rich Menu 四按鈕設定（藍/綠/橙/紫）
- 班表圖片生成（Canvas）
- NVIDIA NIM AI 串接完成