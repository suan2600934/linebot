# 🏥 LINE Bot 醫療資訊系統

## 專案說明
這是一個 LINE Bot，提供藥局和診所資訊查詢服務，支援：
- ✅ 關鍵字搜尋
- ✅ 圖文選單
- ✅ AI 智慧問答（檢索式）
- ✅ 容器化部署（易於轉移陣地）

## 快速開始

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定環境變數
複製 `.env` 檔案並填入你的 LINE Bot 資訊：
```env
LINE_CHANNEL_SECRET=你的_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN=你的_CHANNEL_ACCESS_TOKEN
PORT=3000
```

### 3. 啟動伺服器
```bash
# 開發模式（自動重啟）
npm run dev

# 正式模式
npm start
```

## 部署到 Zeabur

### 方法 1：GitHub 自動部署（推薦）
1. 將程式碼推送到 GitHub
2. 在 Zeabur 連接 GitHub 倉庫
3. 設定環境變數
4. 自動部署

### 方法 2：Docker 部署
```bash
docker build -t linebot .
docker run -p 3000:3000 --env-file .env linebot
```

## 資料庫設定

### 本地模式（測試用）
目前使用記憶體資料，無需設定資料庫。

### Supabase 模式（正式用）
1. 在 Supabase 建立專案
2. 執行 `database/schema.sql` 建立資料表
3. 修改 `.env`：
```env
DATABASE_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

## 資料結構

### 藥局資料表 (pharmacies)
- name: 藥局名稱
- address: 地址
- phone: 電話
- hours: 營業時間
- services: 服務項目
- notes: 備註

### 診所資料表 (clinics)
- name: 診所名稱
- department: 科別
- address: 地址
- phone: 電話
- hours: 看診時間
- specialties: 擅長領域

## 功能規劃

### 已實作
- [x] 基本 LINE Bot 架構
- [x] 文字訊息處理
- [x] 按鍵回傳處理
- [x] 追蹤事件處理
- [x] 健康檢查端點

### 進行中
- [ ] 資料庫整合
- [ ] 關鍵字搜尋
- [ ] AI 檢索問答

### 待辦
- [ ] 地理位置搜尋
- [ ] 管理後台
- [ ] 資料匯入工具

## 技術棧
- Node.js + Express
- @line/bot-sdk
- Docker（容器化）
- Supabase（可選，PostgreSQL）

## 轉移陣地指南

本專案設計為**平台無關**，可輕鬆部署到：
- Zeabur
- Render
- Railway
- Cloud Run
- VPS（DigitalOcean、Linode）
- 傳統伺服器

只需確保環境變數正確，並使用 Docker 或 Node.js 運行即可。

## 授權
ISC