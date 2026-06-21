# LINE Bot 醫療資訊系統 - 專案進度記錄

## 📋 專案概述

**專案名稱**：LINE Bot 醫療資訊系統（藥局/診所查詢）  
**Bot 名稱**：suanclinic_aibot（賜安診所官方帳號）  
**技術棧**：Node.js + Express + @line/bot-sdk + Supabase + ngrok（本地測試）  
**資料庫**：Supabase（PostgreSQL）

---

## ✅ 已完成的工作

### 1. 專案初始化
- [x] 建立專案目錄：`H:\opencode\linebot`
- [x] 初始化 Node.js 專案
- [x] 安裝依賴套件：
  - `express` - Web 伺服器
  - `@line/bot-sdk` - LINE Bot SDK
  - `dotenv` - 環境變數管理
  - `cors` - 跨域支援
  - `nodemon` - 開發模式自動重啟
  - `canvas` - 圖片生成（Rich Menu）

### 2. 核心檔案建立
- [x] `index.js` - LINE Bot 主程式
  - Webhook 處理器
  - 文字訊息回覆
  - Postback 事件處理
  - 追蹤事件處理
  - 錯誤處理與除錯日誌
- [x] `.env` - 環境變數設定
- [x] `package.json` - 專案設定
- [x] `Dockerfile` - 容器化設定（為將來部署準備）
- [x] `database/schema.sql` - 資料庫結構
- [x] `richmenu.json` - Rich Menu 設定
- [x] `setup-menu.js` - Rich Menu 設定腳本
- [x] `README.md` - 專案說明文件

### 3. LINE Bot 功能實作
- [x] Webhook 連線設定
- [x] 簽章驗證（Signature Validation）
- [x] 文字訊息處理：
  - 問候語回應（「嗨」、「你好」）
  - 關鍵字匹配（「藥局」、「診所」）
  - AI 查詢預備（「附近」、「哪裡」、「推薦」）
  - 預設回覆
- [x] Postback 事件處理（Rich Menu 按鈕點擊）
- [x] 追蹤事件處理
- [x] 固定回覆功能：
  - 搜尋藥局
  - 搜尋診所
  - 營業時間資訊
  - 熱門問題

### 4. Rich Menu（圖文選單）設定
- [x] 建立 Rich Menu 結構（2500x1686 像素，四個按鈕）
- [x] 生成預設選單圖片（使用 canvas）
- [x] 上傳圖片並設定為預設選單
- [x] Rich Menu ID: `richmenu-8206cec7abcd003765f91a1b6bac1e19`
- [x] 選單按鈕配置：
  - **左上（藍色）**：💊 查詢藥局 → `action=search_pharmacy`
  - **右上（綠色）**：🏥 查詢診所 → `action=search_clinic`
  - **左下（橙色）**：⏰ 營業時間 → `action=hours_info`
  - **右下（紫色）**：❓ 熱門問題 → `action=faq`

### 5. 本地測試環境
- [x] ngrok 隧道設定
  - 當前網址：`https://untreated-craving-bamboo.ngrok-free.dev`
  - 注意：免費版 ngrok 網址每次重啟會變動
- [x] Webhook URL 設定：`{ngrok-url}/webhook`
- [x] 測試通過：
  - Webhook 驗證成功
  - 文字訊息回覆正常
  - Rich Menu 顯示正常

### 6. 資料庫規劃
- [x] 設計藥局資料表（pharmacies）欄位：
  - name, address, phone, latitude, longitude
  - hours, closed_days, services[], insurance, notes
- [x] 設計診所資料表（clinics）欄位：
  - name, department, address, phone, latitude, longitude
  - hours, closed_days, doctors[], specialties[], insurance, notes
- [x] 建立範例資料：
  - 宏益藥局（嘉義縣水上鄉）
  - 賜安診所（嘉義縣水上鄉）

---

## 🔄 進行中的工作

### 1. 固定回覆邏輯完善
- [ ] 實作 `action=hours_info` 處理（營業時間固定回覆）
- [ ] 實作 `action=faq` 處理（熱門問題固定回覆）
- [ ] 測試所有 Rich Menu 按鈕功能

### 2. 資料準備
- [ ] 整理藥局/診所完整資料（去私密資料化）
- [ ] 確定資料來源：
  - 政府開放資料（衛福部、data.gov.tw）
  - 手動整理（台灣醫療整合平台、嘉義縣藥師公會）
- [ ] 決定初期範圍：嘉義縣水上鄉為測試起點

### 3. AI 檢索功能規劃
- [ ] 設計 RAG（檢索式回答）架構
- [ ] 限定 AI 只根據資料庫內容回答
- [ ] 不給醫療建議，只回覆公開資訊

---

## 📝 待辦事項（下次繼續）

### 優先級 1：完善基本功能
- [ ] 實作 Rich Menu 四個按鈕的固定回覆
  - `search_pharmacy`：回覆藥局清單
  - `search_clinic`：回覆診所清單
  - `hours_info`：回覆營業時間資訊
  - `faq`：回覆熱門問題列表
- [ ] 測試所有按鈕功能正常
- [ ] 優化回覆內容格式（使用 Flex Message）

### 優先級 2：資料匯入
- [ ] 整理至少 10-20 筆藥局/診所範例資料
- [ ] 建立資料匯入腳本（CSV/Excel → Supabase）
- [ ] 測試資料庫查詢功能

### 優先級 3：AI 檢索實作
- [ ] 實作關鍵字檢索（區域、科別、服務）
- [ ] 整合 AI 回答（可選：接入 AI API）
- [ ] 測試各種問句理解

### 優先級 4：部署準備
- [ ] 建立 GitHub 倉庫
- [ ] 推送程式碼到 GitHub
- [ ] 申請 Supabase 專案
- [ ] 執行 `database/schema.sql` 建立資料表
- [ ] 部署到 Zeabur
- [ ] 設定正式環境變數
- [ ] 測試正式環境功能

---

## 🔧 技術細節

### 環境變數（.env）
```env
LINE_CHANNEL_SECRET=545e896c26589cdbc6ad52721cff6c6c
LINE_CHANNEL_ACCESS_TOKEN=BNCxP6KMC+9Ak7IoTUxRoLebxYUSpsf7CksgxqXvmwn...
PORT=3000
NODE_ENV=development

# NVIDIA NIM 設定
NIM_API_URL=https://integrate.api.nvidia.com/v1
NIM_API_KEY=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
NIM_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1

# Supabase 設定
SUPABASE_URL=https://kbpyxboleoefwvdnjcod.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 啟動指令
```bash
# 開發模式（自動重啟）
npm run dev

# 正式模式
npm start

# 設定 Rich Menu
node setup-menu.js

# 啟動 ngrok（新視窗）
ngrok http 3000
```

### 當前 ngrok 網址
- `https://untreated-craving-bamboo.ngrok-free.dev`
- ⚠️ 注意：每次重啟 ngrok 網址會變動，需更新 LINE Webhook URL

### LINE Bot 帳號
- Bot 名稱：suanclinic_aibot（賜安診所官方帳號）
- LINE Developers Channel：已設定完成
- Webhook URL：已設定並驗證通過
- Rich Menu：已設定並顯示正常

---

## 📚 學習筆記

### LINE Bot SDK v9 變更
- 舊版：`new Client()` → `client.replyMessage(token, message)`
- 新版：`new MessagingApiClient()` → `client.replyMessage({ replyToken, messages: [...] })`
- 簽章驗證：`line.validateSignature(body, secret, signature)`

### Rich Menu 設定
- 圖片尺寸：2500x1686 像素
- 按鈕區域：四個象限（各 1250x843）
- 設定後需重新開啟 LINE App 才能看到
- 可隨時更新替換

### ngrok 注意事項
- 免費版網址每次重啟會變動
- 解決方案：
  1. 保持 ngrok 一直運行（最簡單）
  2. 每次重啟後更新 LINE Webhook URL
  3. 部署到 Zeabur 後使用固定網址

---

## 🎯 下次啟動步驟

1. **啟動 LINE Bot 伺服器**：
   ```bash
   cd H:\opencode\linebot
   npm run dev
   ```

2. **啟動 ngrok**（新視窗）：
   ```bash
   ngrok http 3000
   ```
   記錄新的網址

3. **更新 LINE Webhook URL**（如果 ngrok 網址變了）：
   - 前往 LINE Developers 控制台
   - suanclinic_aibot → Messaging API
   - 更新 Webhook URL：`https://新的網址.ngrok-free.dev/webhook`
   - 驗證通過

4. **測試功能**：
   - 在 LINE App 中傳送「你好」
   - 點擊 Rich Menu 四個按鈕測試
   - 確認回覆正常

5. **繼續開發**：
   - 實作固定回覆邏輯
   - 整理並匯入資料
   - 實作 AI 檢索功能

---

## 💡 重要提醒

### 資料安全
- ✅ 只儲存公開資訊（名稱、地址、電話、營業時間）
- ❌ 不儲存：醫師身分證字號、員工個資、病歷資料

### 醫療免責
- AI 回答僅限於公開資訊檢索
- 不提供醫療建議、診斷、用藥指導
- 建議使用者諮詢專業醫療人員

### 部署策略
- 初期：本地測試（ngrok + 記憶體/SQLite）
- 中期：Supabase + Zeabur（免費額度）
- 長期：視流量升級或轉移至 VPS

---

**最後更新**：2026-06-13
**狀態**：基本功能完成，Rich Menu 設定成功，準備實作固定回覆邏輯

---

## 📅 2026-06-17 工作進度

### ✅ 今日完成

#### 1. Rich Menu 圖文選單更新
- 設計新版本馬卡龍四格配色（移除 Emoji）
- 按鈕配置：
  - **左上（藍色）**：診所藥局資訊
  - **右上（粉紅色）**：醫師介紹
  - **左下（綠色）**：醫師門診表
  - **右下（紫色）**：分享官方 LINE
- 最新 Rich Menu ID: `richmenu-ea41f6df16ead552b4a41fa380d86963`

#### 2. 班表查詢功能優化
- 更新 `index.js` 回覆函式
- 數字選擇回覆：輸入 1 查詢本週、輸入 2 查詢完整月份
- 移除選項 3（特定醫師查詢）

#### 3. 班表圖片生成（Canvas）
- 生成 6 張圖片：
  - `schedule-full-month.png` - 完整月份橫向表格
  - `schedule-week1.png` ~ `schedule-week5.png` - 每週橫向表格
- 醫師顏色（已記錄於 `colors.json`）：
  - 周見成 → 藍色 (#3498DB)
  - 鄭名傑 → 紅色 (#E74C3C)
  - 石逸仁 → 綠色 (#27AE60)

#### 4. 知識庫與資料庫更新
- 更新 `knowledge-base.md` 醫師資訊（依據賜安診所提供資料）
- 更新 6 月門診班表（第三週、第四週資料修正）
- 建立 `colors.json` 顏色設定檔
- 更新 `database/doctors.sql` 醫師資料
- 更新 `database/schedule-june-2026.sql` 班表資料

### 🔧 技術更新

#### index.js 新增函式
- `getThisWeekSchedule()` - 本週門診表（本週 6/15-6/21）
- `getFullMonthSchedule()` - 完整月份班表
- 更新 `getSchedule()` - 簡化為兩個選項（1/2）

#### 圖片生成參數（記錄備忘）
- 完整月份圖片：1050 x 360 像素
- 每週圖片：1050 x 360 像素
- 字體：Microsoft JhengHei（粗體 32px 醫師名、20px 標題、14px 圖例）

### ❌ 未完成項目
- （已移至完成）NVIDIA AI 串接（已完成）
- LINE Bot 回覆班表時傳送圖片（已實作）

### 📝 下次工作
- （無）

---

## 📅 2026-06-17（下午）工作進度

### ✅ NVIDIA NIM AI 串接完成

#### 1. NIM 設定
- API URL: `https://integrate.api.nvidia.com/v1`
- API Key: `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`
- Model: `nvidia/llama-3.3-nemotron-super-49b-v1`

#### 2. index.js 新增函式
- `callNIM(userMessage)` - 呼叫 NVIDIA NIM API 生成 AI 回覆
- System Prompt 包含診所資訊、醫師團隊、附近藥局
- 回覆限制 300 字、繁體中文

#### 3. 訊息處理邏輯
- 數字輸入（1/2）→ 回覆班表圖片
- 關鍵字（藥局、診所等）→ 回覆對應資訊
- 其他訊息 → 統一經由 NIM AI 生成自然語言回覆

#### 4. 測試結果
- API 連線：成功
- AI 回覆：正常運作，繁體中文回覆正確

---

**最後更新**：2026-06-17
**狀態**：NVIDIA NIM AI 串接完成，LINE Bot 全面支援 AI 對話

---

## 📅 2026-06-17（下午-晚間）工作進度

### ✅ Rich Menu 圖文選單字體調整

#### 調整內容
- 字體大小：160px（原本 70px）
- 文字樣式：白字黑邊（lineWidth: 3）
- 中英文間距：150px

#### 按鈕配置（不變）
- **左上（藍色）**：診所藥局資訊 Clinic Info
- **右上（粉紅色）**：醫師介紹 Doctor Intro
- **左下（綠色）**：醫師門診表 Schedule
- **右下（紫色）**：分享官方LINE Share LINE

#### 最新 Rich Menu ID
- `richmenu-529c5c82ce9aa7be087bd7b8c3c3e183`

### ✅ 待未來實作功能
- 即時叫號查詢（等診所安裝叫號系統後再評估）

---

## 📅 2026-06-17（晚間）工作進度

### ✅ LINE Bot 安全性與效能優化

#### 安全性加強
- 簽章驗證：缺少簽章直接拒絕（400 錯誤）
- Rate Limit 處理：429 回應「目前訊息較多，請稍後再試」
- 輸入長度限制：超過 2000 字拒絕

#### 效能優化
- Timeout 從 60 秒改為 15 秒
- 訊息處理簡化：移除固定問候回覆，全部交給 AI 處理

### ✅ 醫師資料更新

#### 周見成醫師專長更新
```
專長：小兒科、兒童腸胃、兒童營養、耳鼻喉科
• 青春痘、濕疹、蟹足腫、肥胖性疤痕
• 過敏、皮膚搔癢、蕁麻疹、藥物疹
• 香港腳、灰指甲、癬、外傷傷口治療
• 富貴手、酒精、血管擴張、皰疹
• 小兒尿布疹、異位性皮膚炎、冬季癢
• 水痘、狐臭、禿頭、落髮、汗斑
• 白斑、乾癬、疥瘡、雞眼、病毒疣、甲溝炎
```

#### 用詞修正
- 「超聲波檢查」→ 「超音波檢查」
- 同步更新 `index.js` 和 `knowledge-base.md`

### 🔄 進行中的規劃

#### 排班系統（位於 H:\GEMINI\pss\）
- 排班工具：`auto_schedule.py`
- Excel 班表：`H:\Gemini\pss\賜安診所11506班表.xlsx`
- 自動抓取最新月份的 Excel 檔案

#### 圖檔生成
- 腳本：`generate-schedule-image.ps1`
- 輸出：`schedule-full-month.jpg`（1200px 寬，LINE 和 Facebook 共用）
- 自動抓取 `H:\Gemini\pss\*115*.xlsx` 中最新修改的檔案

### ✅ LINE Bot 和 Facebook 共用圖檔
- 圖檔生成：`generate-schedule-image.ps1`
- 輸出：`H:\opencode\linebot\schedule-full-month.jpg`（1200px 寬）
- LINE Bot 和 Facebook 共用同一張圖

### ❌ 未完成
- Facebook 上傳功能（尚未完成，測試中）
- 即時叫號查詢（等診所安裝叫號系統後再評估）

### 📝 下次工作重點
1. 測試 Facebook 上傳
2. 排班系統全自動化

---

## 📅 2026-06-19 工作進度

### ✅ Facebook 上傳資料夾搬移
- 將 `H:\Gemini\pss\facebook-upload` 移動到 `H:\opencode\linebot\facebook-upload`
- 更新 `convert-and-upload.ps1` 的圖檔輸出路徑（統一到 `schedule-full-month.jpg`）
- 更新 `config.local.ps1` 加入 `ScheduleYear` 設定（明年改為 "116" 即可）

### ✅ Facebook Token 問題
- 發現 Token 已過期（`Session has expired on Monday, 15-Jun-26`）
- Facebook 自動上傳功能需等待 Token 重新申請或 App 審核通過
- 目前改用**手動上傳 Facebook**，圖檔已具備

### ✅ 排班系統全自動化完成

#### generate-schedule-image.ps1 功能增強
1. **動態年份設定**：從 `config.local.ps1` 讀取 `ScheduleYear`
2. **圖檔 + 文字同步更新**：執行一次，同時生成：
   - `schedule-full-month.jpg` — LINE Bot 發送圖片
   - `knowledge-base.md` — AI 讀取文字回答

#### Excel 解析邏輯
- 正確解析橫向排列的班表結構（週一～週日橫排，時段縱排）
- 讀取欄位：Col2-8（跳過 Col1 標題欄）
- 狀態機追蹤：週標題 → 日期列 → 早診 → 午診 → 晚診

#### 日期格式優化
- 從 `6月1日` 改為 `6/1(一)` 格式
- 每週從星期一開始（對應一～日）
- 過濾空白列（第五週只有 2 天時不輸出空白行）

#### 設定值集中管理
- `ScheduleYear` 設定在 `facebook-upload\config.local.ps1`
- 明年只需修改這一個地方，適用於所有腳本

### 📝 每月月底操作流程
```powershell
cd H:\opencode\linebot
.\generate-schedule-image.ps1
```
一次執行，圖片和 AI 資料同步更新。

### 🔧 技術更新
- `generate-schedule-image.ps1` — 圖檔生成 + knowledge-base.md 更新
- `knowledge-base.md` — AI 知識庫（班表自動同步）
- `facebook-upload/config.local.ps1` — ScheduleYear 設定

---

**最後更新**：2026-06-19
**狀態**：排班系統全自動化完成，LINE Bot + AI 知識庫同步更新

---

## 📅 2026-06-19（下午）工作進度

### ✅ Rich Menu 六按鈕更新

#### 新增按鈕
- **預防保健檢查** → 回覆圖片 `health_exam.jpg` + 文字說明
- **兒童預防注射** → 回覆圖片 `child_vaccine.jpg` + 文字說明

#### 配置調整（2x3 → 3x2）
| 上排 | 馬卡龍藍 | 馬卡龍粉 | 馬卡龍綠 |
|------|----------|----------|----------|
| 圖示 | 診所藥局資訊 | 醫師介紹 | 醫師門診表 |
| 下排 | 馬卡龍紫 | 馬卡龍橙 | 馬卡龍淡紫 |
| 圖示 | 分享LINE | 預防保健檢查 | 兒童預防注射 |

#### 字體調整
- 字體大小：100px（原本 120px）
- 中英文間距：100px（原本 80px）
- 最新 Rich Menu ID: `richmenu-8b3552aa67aee2ed046ef6f1169ec478`

### ✅ Supabase 資料庫建立

#### 專案資訊
- URL: `https://kbpyxboleoefwvdnjcod.supabase.co`
- 已建立資料表：
  - `clinics` - 診所基本資訊
  - `doctors` - 醫師資料（3筆）
  - `services` - 服務項目（7筆）
  - `pharmacies` - 附近藥局（1筆）

#### 資料內容
**診所**：賜安診所
**醫師**：周見成（院長）、鄭名傑、石逸仁
**服務**：成人健康檢查、B/C型肝炎篩檢、兒童預防保健、疫苗注射等
**藥局**：宏益藥局

### ✅ index.js Supabase 整合

#### 修改內容
- 新增 `@supabase/supabase-js` 套件
- 建立 Supabase 客戶端連線
- `loadKnowledgeBase()` 改為非同步從 Supabase 讀取
- `callNIM()` 改為使用動態知識庫

#### 環境變數新增
```env
SUPABASE_URL=https://kbpyxboleoefwvdnjcod.supabase.co
SUPABASE_SERVICE_KEY=eyJhbG...
```

### ❌ 未完成項目
- LINE ID ↔ 病歷號 對應功能（暫時擱置）
- Facebook 自動上傳（Token 過期，手動上傳中）

### 📝 下次工作重點
1. 測試新 Rich Menu 按鈕功能
2. 部署到 Zeabur（擺脫 ngrok）
3. 建立 GitHub 倉庫備份程式碼

---

**最後更新**：2026-06-19
**狀態**：Supabase 資料庫串接完成，Rich Menu 六按鈕上線

---

## 📅 2026-06-20 工作進度

### ✅ 醫師介紹回覆內容修正

#### 更新內容（getDoctorIntro）
- 標題改為「【醫師團隊】」（無 Emoji）
- 分隔線改為「━━━━━━━━━━━━━━━」
- 周見成醫師專長更新：新增「預防保健、兒童預防注射、一般內科、家醫科」
- 用詞修正：「酒精」→「酒糟」
- 用詞修正：「狐臭、禿頭」→「水痘、禿頭、落髮、汗斑」
- 鄭名傑、石逸仁：專長列表完整補齊（與周見成一致）

#### 同步更新
- `index.js` 的 `getDoctorIntro()` 函式
- `knowledge-base.md` 的醫師資料

### ✅ Supabase 資料庫同步

#### 發現問題
- 原本 `doctors` 資料表缺少 `title` 和 `specialties` 欄位
- RLS 權限已確認為 disabled

#### 新增欄位（SQL）
```sql
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialties TEXT[];
```

#### 更新醫師資料
執行 `database/supabase-setup.js`，成功同步：
- 周見成（院長）：完整專長列表 + 完整經歷
- 鄭名傑（醫師）：完整專長列表 + 經歷
- 石逸仁（醫師）：完整專長列表 + 經歷 + USMLE

### ✅ getDoctorIntro() 動態化

#### 修改內容
- 從原本寫死的靜態文字，改為從 Supabase `doctors` 資料表讀取
- 動態生成醫師介紹格式
- 未來只要更新 Supabase 資料，LINE 回覆就會自動更新

### ✅ Supabase Storage 設定

#### 建立 Bucket
- 名稱：`images`
- 設為公開讀取

#### 上傳圖片
- `health_exam.jpg` - 預防保健檢查
- `child_vaccine.jpg` - 兒童預防注射
- `schedule-full-month.jpg` - 完整月份班表
- `schedule-week1.png` ~ `schedule-week5.png` - 每週班表

#### Storage URL
```
https://kbpyxboleoefwvdnjcod.supabase.co/storage/v1/object/public/images/
```

### ✅ index.js 圖片 URL 更新

#### 修改內容
- 新增 `STORAGE_URL` 常數，指向 Supabase Storage CDN
- 更新所有圖片 URL：
  - `getThisWeekSchedule()` → `schedule-week3.png`
  - `getFullMonthSchedule()` → `schedule-full-month.jpg`
  - `getHealthExam()` → `health_exam.jpg`
  - `getChildVaccine()` → `child_vaccine.jpg`

#### 優點
- 部署到 Zeabur 後，圖片仍可正常顯示
- 不再綁定本地電腦

### 🔧 技術更新

#### index.js 修改函式
- `getDoctorIntro()` - 改為非同步從 Supabase 讀取
- 圖片 URL 全部改用 `STORAGE_URL`

#### 資料庫更新
- `database/supabase-setup.js` - 完整醫師資料（specialties 欄位完整）
- `knowledge-base.md` - 同步更新醫師資料

### 📝 統一管理架構

| 功能 | 資料來源 | 更新方式 |
|------|----------|----------|
| Rich Menu 按鈕 | LINE 伺服器 | 需刪除重建 |
| 醫師介紹（getDoctorIntro） | Supabase doctors 表 | 直接更新資料庫 |
| AI 知識庫（loadKnowledgeBase） | Supabase 各資料表 | 直接更新資料庫 |
| 圖片（health_exam、child_vaccine、schedule） | Supabase Storage | 上傳圖片即可 |

### 📝 下次工作重點
1. 部署到 Zeabur（正式環境）
2. 建立 GitHub 倉庫備份程式碼
3. 測試所有功能正常運作

### ✅ 資料庫與程式同步優化

#### 更新 knowledge-base.md
- LINE ID：`@334snxnh`（原本是 @suanclinic_aibot）
- 新增 Facebook 網址：`https://www.facebook.com/suanclinic?locale=zh_TW`

#### Supabase clinics 資料表更新
- 新增 `line_id` 欄位
- 新增 `facebook_url` 欄位
- 更新賜安診所資料

#### 修改 getChildVaccine() 回覆內容
- 新增提醒：「⚠️ 提醒：兒童預防注射由周見成醫師執行，請家長安排在周醫師門診時段帶小朋友前來。」

#### 修改 getHealthExam() 回覆內容
- 成人健康檢查：40歲以上 → 30歲以上
- 免費B型、C型肝炎篩檢（原本分開）
- 新增「大腸癌篩檢」
- 新增提醒：「⚠️ 提醒：成人健康檢查由周見成醫師執行，請安排在周醫師門診時段前來。」

#### LINE 對話記錄討論
結論：**不需要**記錄到資料庫
- LINE 官方後台已有完整對話記錄
- 涉及健康問題的對話不應隨意儲存
- 避免隱私問題

### 📝 Zeabur / Supabase / GitHub 架構關係

```
使用者 → LINE → Zeabur (執行 index.js) → Supabase (資料+圖片)
                    ↓
               GitHub (只是備份，不影響運行)
```

| 服務 | 用途 | 運行時是否需要 |
|------|------|--------------|
| **Zeabur** | 放置網站/機器人的伺服器 | ✅ 需要（24小時開機） |
| **Supabase** | 儲存醫師資料、班表圖片 | ✅ 需要（隨時查詢） |
| **GitHub** | 程式碼備份、版本控制 | ❌ 只是備份，運行不影響 |

---

**最後更新**：2026-06-20
**狀態**：資料全面雲端化，支援動態更新

---

## 📅 2026-06-21 工作進度

### ✅ GitHub 倉庫建立

#### 建立過程
1. 在 GitHub 建立 `suan2600934/linebot` 倉庫
2. 初始化 git 並推送程式碼
3. 設定 `.gitignore` 排除 `node_modules` 和 `.env`

### ✅ Zeabur 部署

#### 部署過程
1. 在 Zeabur 建立新專案，連接到 GitHub
2. 解決多個部署問題：
   - Dockerfile 修改：使用 `node:22-alpine`
   - 安裝 canvas 所需的系統套件（`cairo-dev` 等）
   - 安裝 `ws` 套件解決 Node.js WebSocket 問題
   - 修改 `index.js` 固定監聽 port 3000

#### 環境變數設定（Zeabur）
```env
PORT=3000
LINE_CHANNEL_SECRET=545e896c26589cdbc6ad52721cff6c6c
LINE_CHANNEL_ACCESS_TOKEN=BNCxP6KMC+9Ak7IoTUxRoLebxYUSpsf7CksgxqXvmwn...
SUPABASE_URL=https://kbpyxboleoefwvdnjcod.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
NIM_API_URL=https://integrate.api.nvidia.com/v1
NIM_API_KEY=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
```

#### Docker 最終內容
```dockerfile
FROM node:22-alpine
RUN apk add --update python3 make g++ cairo-dev jpeg-dev libpng-dev giflib-dev pango-dev
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### ✅ index.js 最終修改

#### PORT 設定
```javascript
const PORT = 3000;  // 固定使用 3000，不理會環境變數
app.listen(Number(PORT), '0.0.0.0', () => {
```

#### WebSocket 修補
```javascript
// Node.js < 22 的 WebSocket 修補
try {
  const WebSocket = require('ws');
  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = WebSocket;
  }
} catch (e) {
  console.log('ws package not found, WebSocket polyfill skipped');
}
```

### 📝 LINE Bot 正式上線

#### 網址資訊
- **LINE Webhook URL**: `https://suanclinic.zeabur.app/webhook`
- **LINE Bot 名稱**: suanclinic_aibot（賜安診所官方帳號）

#### 部署架構
```
使用者 → LINE → Zeabur (執行 index.js:3000) → Supabase (資料+圖片)
                     ↓
                GitHub (程式碼備份)
```

### ⚠️ 重要教訓

1. **PORT 問題**：Zeabur 會強制使用 port 8080，需要在 index.js 中固定監聽 3000
2. **環境變數**：LINE_CHANNEL_SECRET 和 LINE_CHANNEL_ACCESS_TOKEN 必須設定
3. **WebSocket**：Node.js < 22 需要 ws 套件或升級到 Node 22
4. **健康檢查**：使用 HTTP `/health` 端點，不要用 TCP

### 📝 下次工作重點
1. 確認所有 LINE 功能正常運作
2. 測試 Rich Menu 按鈕
3. 更新 LINE Webhook URL（如有變動）

---

**最後更新**：2026-06-21
**狀態**：LINE Bot 正式上線 Zeabur