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

**最後更新**：2026-06-22
**狀態**：核心功能完成，資料全面雲端化，支援動態更新

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