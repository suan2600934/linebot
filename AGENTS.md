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
| **慢性病慢連箋** | **slow_rec.dbf → Supabase chronic_prescriptions_date** | **sync script 每 7 天** |

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

### 優先級 5：慢性病領藥查詢（LINE Bot）✅ 已完成
- [x] `lineid_code/index.js` - 新增 `/api/admin/recno-by-link` API
- [x] 建立 Supabase 資料表 `chronic_prescriptions_date`
- [x] 建立 sync script（每 7 天排程）
- [x] `index.js`（LINE Bot）- 「💊 領藥時間」改為「💊 慢性病領藥查詢」，實作處理邏輯
- [x] 日期格式統一 - Supabase 存 `1150928`（7位數），LINE Bot 回覆 `2026/09/28`
- [x] `rocToDate()` 支援新舊格式（`B50701` 和 `1150928`）
- [x] 錯誤訊息改為「最近三個月內查無慢性病領藥記錄。」

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

# LINE ID Code Service
LINEID_CODE_URL=https://lineid-code.zeabur.app
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

## 📅 2026-07-06 工作進度

### 🆕 慢性病領藥查詢系統（規劃中）

#### 需求背景
- 慢性病連續處方箋效期：90 天（30天×3次）或 84 天（28天×3次）
- 每次回診開一張慢連箋，一張慢連箋可領 3 次藥
- 病人點選「💊 慢性病領藥查詢」後，根據綁定的病歷號查詢最近三個月內的慢連箋領藥記錄

#### slow_rec.dbf 欄位說明（慢連箋領藥紀錄）
| 欄位 | 說明 | 範例 |
|------|------|------|
| CODE | 病歷號（6位） | 036787 |
| DATE | 首次開立慢連箋日期（民國，A=10X年，B=11X年） | B00516 |
| S_DATE | 本次實際領藥日期（民國） | B50604 |
| S_SERNO | 慢連箋第幾次領藥（1/2/3） | 1, 2, 3 |
| S_DAYS | 慢連箋總天數（90或84） | 90 |
| DAYS | 每次給藥天數（30或28） | 30 |
| MEMO | 主診斷 ICD-9 碼 | 4019 |

#### 日期格式
- `A` 開頭：民國 10X 年（例 A50806 → 108/08/06）
- `B` 開頭：民國 11X 年（例 B20821 → 112/08/21）

#### 資料群組邏輯（已確認）
```
一個 CODE 同時只有一張慢連箋（效期內，診所規定）
同一個 CODE，可能有很多張不同的慢連箋（每次回診開新的）
同一個 DATE，只屬於某一張慢連箋

在最近 90 天內的記錄中：
→ 對每個 CODE，取 DATE 最大的那一筆 = 目前有效的慢連箋
→ DATE 較小的 = 已過期或放棄的舊慢連箋（不理會）
```

#### Supabase 資料表規劃
```sql
CREATE TABLE chronic_prescriptions_date (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,           -- 病歷號
    first_date VARCHAR(10) NOT NULL,     -- 首次開立日期（民國，如 B00516）
    total_days INTEGER NOT NULL,         -- 總天數（90 或 84）
    per_days INTEGER NOT NULL,           -- 每次給藥天數（30 或 28）
    serno1_date VARCHAR(10),             -- 第1次領藥日期（NULL=未領）
    serno2_date VARCHAR(10),             -- 第2次領藥日期
    serno3_date VARCHAR(10),             -- 第3次領藥日期
    expire_date VARCHAR(10) NOT NULL,    -- 過期日（計算值）
    synced_at TIMESTAMPTZ DEFAULT now(), -- 同步時間
    UNIQUE(code)                         -- 每個病歷號只有一筆
);
```

#### Sync Script 規劃
```
執行頻率：每 7 天（排程）
資料來源：H:\clinic_file\slow_rec.dbf
目標：Supabase chronic_prescriptions_date

邏輯：
1. 讀取 slow_rec.dbf 最近 90 天內所有記錄
2. 依 CODE 分組
3. 對每個 CODE，取 DATE 最大的那一筆（目前有效的慢連箋）
4. 從該筆記錄取出 S_SERNO 1/2/3 的 S_DATE
5. 計算 expire_date = 第1次領藥日 + (per_days * 3 - 1) 天
6. Upsert 到 Supabase
```

#### 新 API 規劃（lineid_code/index.js）
```
GET /api/admin/recno-by-link?link_id=xxx
Header: x-unbind-api-key: <key>

用途：LINE Bot 收到「慢性病查詢」時，用 link_id 取得完整 recno 來查 Supabase

Response:
{ "ok": true, "data": { "recno": "036787" } }
或
{ "ok": false, "error": "找不到" }
```

#### LINE Bot 回覆流程（已確認）
```
圖文選單「查詢就醫資訊」(action=query_bindings)
    ↓
Flex Carousel（顯示所有綁定，藍色「選擇」按鈕）
    ↓
點 [選擇] → handleViewMedicalInfo → Flex 選單（5個按鈕）
    ↓
點 [💊 慢性病領藥查詢] → action=chronic_prescription_query&link_id=xxx
    ↓
LINE Bot 呼叫 lineid_code 取得完整 recno
    ↓
查詢 Supabase chronic_prescriptions_date
    ↓
回覆慢連箋領藥資訊
```

#### LINE Bot 回覆格式規劃
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：114/05/01（已領）
第2次領藥：114/05/31（已領）
第3次領藥：114/06/28（建議領藥日）

處方效期：至 114/08/02
⚠️ 還有 27 天效期，請在過期前完成第 3 次領藥
```

**病歷號遮罩格式**：`第一碼*****最後一碼`（如 `036787` → `0*****7`）

**逾時未領藥提醒邏輯**：
- 第2次：未領 + 建議日已過 → ⚠️ 第2次已逾期，請盡快領藥
- 第3次：未領 + 建議日已過 → ⚠️ 第3次已逾期，請盡快領藥
- 處方已過期 → ⚠️ 處方已過期，請回診

#### 實作清單（這次）
1. [x] `lineid_code/index.js` - 新增 `/api/admin/recno-by-link` API
2. [x] Supabase - 建立 `chronic_prescriptions_date` 資料表（`database/chronic_prescriptions_date.sql`）
3. [x] sync script - 建立並設定排程（每 7 天）
4. [x] `index.js`（LINE Bot）- 「💊 領藥時間」改為「💊 慢性病領藥查詢」，實作處理邏輯

#### 不在這次實作範圍
- ICD-10 診斷名稱對照（只顯示 ICD 碼）
- 欠單查詢、抽血報告、慢性病資訊

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
| `verification_codes_archive` | 30 天前台端需要綁定 |

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

**最後更新**：2026-07-09
**狀態**：慢性病領藥查詢系統邏輯優化完成，準備部署

---

## 📅 2026-07-09 工作進度（下午）

### ✅ 慢性病領藥查詢邏輯修正

#### 健保局規定
- 餘藥要剩下 10 天以內才可以重新領藥（<=9天）
- 因此建議領藥區間 = 前一次領藥日 + (per_days - 8) ~ + (per_days - 8 + 8)
  - per_days=30 → +22 ~ +30 天
  - per_days=28 → +20 ~ +28 天

#### 建議領藥區間計算

**第2次領藥（serno2 為空）**：
- 區間最小日 = 第1次 + (per_days - 8)
- 區間最大日 = 區間最小日 + 8 天
- 第3次區間 = 第1次 + (per_days*2 - 8) ~ +8天

**第3次領藥（serno3 為空）**：
- 若第2次延後：區間 = [第2次實際 + (per_days - 8), +8天]
- 若第2次準時：區間 = [第1次 + (per_days*2 - 8), +8天]
- 效期檢查：
  - 效期 < 區間最小日 → 回報「第3次已過期，請回診」
  - 效期在區間內 → 區間最大日改為效期日
  - 效期 > 區間最大日 → 沒問題

#### 回覆格式

**第2次領藥**：
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/05/01（已領）
第2次建議領藥區間：2026/05/23-2026/05/31
第3次建議領藥區間：2026/06/22-2026/06/30

處方效期：至 2026/08/02
⚠️ 還有 27 天效期，請在過期前完成領藥

ℹ️ 以上資訊僅供參考，實際可領藥日期會因實際餘藥數量變動。
```

**第3次領藥（正常）**：
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/05/01（已領）

第2次領藥：2026/05/31（已領）
第3次建議領藥區間：2026/06/22-2026/06/30

處方效期：至 2026/08/02
⚠️ 還有 27 天效期，請在過期前完成領藥

ℹ️ 以上資訊僅供參考，實際可領藥日期會因實際餘藥數量變動。
```

**第3次領藥（延後）**：
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/05/01（已領）

第2次領藥：2026/06/10（已領）（延後領藥）
第3次建議領藥區間：2026/07/02-2026/07/10

處方效期：至 2026/08/02
⚠️ 還有 27 天效期，請在過期前完成領藥

ℹ️ 以上資訊僅供參考，實際可領藥日期會因實際餘藥數量變動。
```

**第3次領藥（效期過了）**：
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/05/01（已領）

第2次領藥：2026/06/10（已領）（延後領藥）

⚠️ 第3次已過期，請回診

處方效期：至 2026/07/08
⚠️ 處方已過期，請回診

ℹ️ 以上資訊僅供參考，實際可領藥日期會因實際餘藥數量變動。
```

#### 程式修改
- [x] `index.js` - `handleChronicPrescriptionQuery()` 重寫
- [x] 第2次領藥：直接顯示建議日
- [x] 第3次領藥：顯示前兩次實際日期 + 區間建議
- [x] 延後領藥偵測
- [x] 效期檢查與區間截斷
- [x] 每次回覆加上貼心提醒

#### Bug 修復
- [x] `API_BASE_URL` 缺少 fallback → 改為 `${process.env.API_BASE_URL || 'https://lineid-code.zeabur.app'}`
- [x] 慢性病 API 回應非 JSON 時的錯誤處理
- [x] `lineid-code` 服務部署在 `line-binding` 分支，需 merge 到 master
- [x] `UNBIND_API_KEY` 未在 LINE Bot 服務設定
- [x] `API_BASE_URL` 未在 LINE Bot 服務設定（舊名是 `LINEID_CODE_URL`）
- [x] 病歷號補零：`code` 欄位存 6 位數（如 `000194`），需 pad recno

---

## 📅 2026-07-08 工作進度

### ✅ 慢性病領藥查詢系統（實作完成）

#### 核心功能
- [x] `lineid_code/index.js` - 新增 `/api/admin/recno-by-link` API
- [x] Supabase - 建立 `chronic_prescriptions_date` 資料表
- [x] sync script - `sync_chronic.py` 每 7 天排程同步
- [x] `index.js`（LINE Bot）- 「💊 領藥時間」改為「💊 慢性病領藥查詢」
- [x] 日期格式修正 - 統一使用 7 位數 ROC 格式（`1150928`）

#### 回覆格式
```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/07/01（已領）
第2次領藥：2026/07/31（建議領藥日）
第3次領藥：2026/08/28（建議領藥日）

處方效期：至 2026/09/28
⚠️ 還有 27 天效期，請在過期前完成第 3 次領藥
```

#### 錯誤訊息
- 查無記錄：「最近三個月內查無慢性病領藥記錄。」
- 系統錯誤：「❌ 系統錯誤，請稍後再試。」

---

## 📊 ROC 日期格式處理邏輯

### 資料流
```
slow_rec.dbf (DBF)
    ↓ [讀取原始記錄]
    ├── DATE 欄位：B50701（A/B 前綴格式，6 字元）
    ├── S_DATE 欄位：B50701（A/B 前綴格式，6 字元）
    ↓ [dbf_date_to_roc() 轉換]
Supabase chronic_prescriptions_date
    ├── first_date：1150701（ROC 格式，7 位數，無 A/B 前綴）
    ├── serno1_date：1150701
    ├── serno2_date：null / 1150731
    ├── serno3_date：null / 1150830
    ├── expire_date：1150928
    ↓ [rocToDate() 解析]
LINE Bot 回覆
    └── 顯示：2026/09/28（西元格式）
```

### 欄位說明
| 欄位 | 來源 | 說明 | 是否為 null |
|------|------|------|-------------|
| `first_date` | DBF `DATE` | 慢連箋開立日期（醫師開處方日） | 否 |
| `serno1_date` | DBF `S_DATE` (S_SERNO=1) | 第1次實際領藥日 | 是（若尚未領） |
| `serno2_date` | DBF `S_DATE` (S_SERNO=2) | 第2次實際領藥日 | 是 |
| `serno3_date` | DBF `S_DATE` (S_SERNO=3) | 第3次實際領藥日 | 是 |
| `expire_date` | 計算值 | 過期日 = serno1_date + total_days - 1 | 否 |
| `total_days` | DBF `S_DAYS` | 總天數（90 或 84） | 否 |
| `per_days` | DBF `DAYS` | 每次給藥天數（30 或 28） | 否 |

**注意**：`first_date` 和 `serno1_date` 理論上可能是不同日期（開立日 vs 實際領藥日），但目前 sync 邏輯中，若病人已領第1次，兩者通常相同。

### 函式職責對照表

| 檔案 | 函式 | 輸入格式 | 輸出格式 | 用途 |
|------|------|----------|----------|------|
| `sync_chronic.py` | `dbf_roc_to_date()` | `B50701`（6字元含A/B前綴） | Python datetime | 讀取 DBF 原始資料、計算近90天過濾、排序取最大DATE |
| `sync_chronic.py` | `dbf_date_to_roc()` | `B50701`（6字元含A/B前綴） | `1150701`（7位數） | 存入 Supabase 前去除 A/B 前綴 |
| `sync_chronic.py` | `roc_to_date()` | `1150701`（7位數或6位數） | Python datetime | 解析已轉換的 ROC 字串（用於計算過期日） |
| `sync_chronic.py` | `date_to_roc()` | Python datetime | `1150928`（7位數） | 計算過期日後存回 Supabase |
| `index.js` | `rocToDate()` | `B50701`（舊）或 `1150928`（新） | JS Date | LINE Bot 讀取 Supabase 資料後解析日期 |
| `index.js` | `dateToRocStr()` | JS Date | `115/09/28`（顯示用） | LINE Bot 回覆時格式化給病人看 |

### DBF A/B 格式解析規則（用於 `dbf_roc_to_date()`）
```
A5 = 10*10 + 5 = 105 年（ROC 105 年 = 西元 2016 年）
B5 = 11*10 + 5 = 115 年（ROC 115 年 = 西元 2026 年）

B50701 → B（prefix=11）+ 5（year_digit）+ 07（月）+ 01（日）
       → ROC 115/07/01 → 西元 2026/07/01
```

### Supabase 儲存格式（無 A/B 前綴）
```
1150701 = ROC 115 年 07 月 01 日 = 西元 2026/07/01
1150928 = ROC 115 年 09 月 28 日 = 西元 2026/09/28
```

### 過去 Bug 原因分析（2026-07-08）
1. **expire_date 輸出 `B150928`（7字元）**：錯誤使用 `year_part: 02d`，導致 `B15`（=125年）而非 `B5`（=115年）
   - 修正：`date_to_roc()` 改為 `f"{roc_year}{date_obj.month:02d}{date_obj.day:02d}"`，輸出固定 7 位數
2. **roc_to_date() 用於 DBF 原始資料**：兩種格式混用導致解析失敗
   - 修正：分開 `dbf_roc_to_date()`（解析含 A/B 前綴）和 `roc_to_date()`（解析純數字格式）
3. **LINE Bot `rocToDate()` 只支援舊格式**：無法解析 Supabase 的 `1150928`
   - 修正：同時支援 `A/B` 前綴（舊）和純數字（新）兩種格式

### index.js rocToDate() 邏輯
```javascript
const rocToDate = (rocStr) => {
    if (!rocStr || rocStr.length < 5) return null;
    try {
      const prefix = rocStr[0].toUpperCase();
      let year, month, day;
      if (prefix === 'A' || prefix === 'B') {
        // 舊格式：B50701 → B=11, year_digit=5 → 115 年
        const yearBase = prefix.charCodeAt(0) - 64 + 9;  // A=10, B=11
        const yearDigit = parseInt(rocStr[1]);  // 只取 1 位數！
        year = yearBase * 10 + yearDigit;
        month = parseInt(rocStr.slice(2, 4));
        day = parseInt(rocStr.slice(4, 6));
      } else {
        // 新格式：1150928 → ROC 年=115
        year = parseInt(rocStr.slice(0, 3));
        month = parseInt(rocStr.slice(3, 5));
        day = parseInt(rocStr.slice(5, 7));
      }
      return new Date(year + 1911, month - 1, day);
    } catch { return null; }
  };
```

### LINE Bot 回覆給病人的日期格式
病人看到的是 `2026/09/28`（西元年月日），不是 `1150928` 或 `B50928`。

---

## 📅 2026-06-29 工作進度

### ✅ 取消綁定功能實作完成

#### 問題修復經過
- **LINE Flex Message 400 錯誤**：按鈕的 `style`/`color` 欄位在 footer 多按鈕佈局中會觸發 LINE API 400 錯誤，改為移除這些欄位
- **handlePostback 條件判斷錯誤**：`data === 'action=view_medical_info'` 應改為 `action === 'view_medical_info'`（使用 URLSearchParams 解析後的 action 變數）
- **Zeabur 部署問題**：根目錄缺少 `package.json`，導致 `express`、`dotenv` 等依賴未安裝
- **分支不一致**：`line-binding` 分支落後 master，需手動 merge

#### Flex Message 格式注意
- `style`/`color` 欄位在 footer 多按鈕佈局中會造成 LINE 400 錯誤
- 單按鈕時可使用，複數按鈕時需移除

#### 已完成的流程
```
圖文選單「查詢就醫資訊」(action=query_bindings)
    ↓
Flex Carousel（顯示所有綁定，藍色「選擇」按鈕）
    ↓
點 [選擇] → Flex 選單（取消綁定 + 4個施工中）
    ↓
點 [取消綁定] → 二次確認
    ↓
點 [是，解除綁定] → ✅ 已解除綁定
```

#### 待未來實作
- [ ] 欠單查詢（action=coming_soon）
- [ ] 抽血報告（action=coming_soon）
- [ ] 慢性病資訊（action=coming_soon）
- [x] 領藥時間 → 改為「💊 慢性病領藥查詢」（2026-07-06 規劃）
- [x] patdb_query.py（櫃台端查詢/取消綁定）- **v1.11 已實作完成**

#### patdb_query.py 實作需求（v1.11 已完成）

**目的**：支援「綁定人 A → 被綁定人 B」一對一關係，解決多人共用LINE導致無法確認要取消哪個的問題

**本地 SQLite Schema（v1.11）**：
```sql
CREATE TABLE binding_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    binder_name TEXT NOT NULL,        -- 綁定人姓名
    binder_idno TEXT,                 -- 綁定人身分證
    binder_birth TEXT,                -- 綁定人生日（6位數如490101）
    patient_name TEXT NOT NULL,       -- 被綁定人姓名
    patient_idno TEXT,                -- 被綁定人身分證
    patient_birth TEXT,               -- 被綁定人生日
    recno TEXT NOT NULL,              -- 病歷號
    recno_hash TEXT NOT NULL,
    binding_time TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT
)
```

**功能**：
- Tab1 分為「綁定人 A」和「被綁定人 B」兩個搜尋區
- 產生驗證碼前檢查是否重複綁定（A 已綁過 B）
- Tab2 四種查詢方式：全部 / 依綁定人 / 依被綁定人 / 依時間
- 生日輸入 490101，顯示自動轉為 49/01/01

**UI 提示**：
- `💡 生日請輸入6位數，如：490101，顯示會自動轉為 49/01/01`
- `💡 姓名/身份證/生日/RECNO 任一字元符合即符合`

**顯示格式**：
```
【A】張大明(生日:49/01/01/ID:A123456789) 綁定 【B】陳大同(生日:52/06/18/ID:B987654321) | RECNO：003245
```

**重要**：刪除 `bindings.db` 後重新執行（schema 有變更）

#### 重要 Commit 記錄（更新）
| Commit | 說明 |
|--------|------|
| `2850ab9` | line-binding 實驗開始前的乾淨狀態 |
| `73eda7e` | line-binding 和 master 最後共用的 commit |
| `b74f1a8` | merge master into line-binding（解決衝突） |
| `eaa0fcb` | restore blue primary style for 選擇 button |

---

## 📅 歷史記錄（2026-06-13 ~ 2026-21）

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