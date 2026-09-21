# 賜安診所 LINE Bot 每月班表更新流程

## 架構說明

- **班表資料來源**：由你以 **Tab 格式** 提供（從 Excel 直接複製），貼到 `schedule-input.txt`。
- **知識庫附加**：你貼好後告訴我「貼好了」，我執行 `node append-schedule.js` 自動附加到 `knowledge-base.md`。
- **月份版檔名**：`schedule-full-YYYY-MM.jpg`、`schedule-YYYY-MM-weekN.png`（不再使用舊別名）。
- **同步工具**：`sync-schedule.js` 讀取 `knowledge-base.md` 的 Tab 格式寫入 `schedules` 表。

---

## 每次月底工作

### 1. 貼上新月份班表

開啟 `schedule-input.txt`，從 Excel 複製 Tab 格式班表貼入，存檔後告訴我「貼好了」。

我執行 `node append-schedule.js`，系統會：
- 從內容偵測月份（如 `115年8月`）
- 更新 `knowledge-base.md` 的「最後更新」日期
- 自動加上 `## 115年8月門診班表` 標題並附加到最底部

### 2. 產生全月圖

請你在自己的 **PowerShell 7** 終端機執行：

```powershell
cd H:\opencode\linebot
.\generate-schedule-image.ps1
```

輸出：`schedule-full-YYYY-MM.jpg`

### 3. 產生週圖

```bash
node generate-weekly-schedules.js
```

輸出：`schedule-YYYY-MM-week1.png` ~ `schedule-YYYY-MM-week6.png`

### 4. 上傳圖檔至 Supabase

```bash
node upload-schedule-images.js
```

### 5. 同步排程資料至資料庫

```bash
node sync-schedule.js
```

---

## 中文注意事項

- `schedule-input.txt`、`knowledge-base.md` 一律使用 **UTF-8 無 BOM**。
- `append-schedule.js` 讀寫均为 UTF-8，直接由我執行，無需你在終端機操作。
- 只有 `generate-schedule-image.ps1` 需要在你的 **PowerShell 7** 終端機執行（因為它是互動式腳本）。

---

## 舊別名處理

- `schedule-full-month.jpg`、`schedule-weekN.png` 等舊別名已**不產生**。
- `index.js` 已改為只使用月份版檔名。
- Supabase Storage 中殘存的舊別名檔案可保留（不影響運作），有空再一次性清理。

---

## 其他事項

- **GitHub 備份**：完成後執行 `git add . && git commit -m "月度更新: YYYY-MM" && git push`
- **LINE Bot 驗證**：傳「門診表」測試是否顯示新月份圖片
- **Supabase 檢查**：確認 `schedules` 表只有本月 5 筆資料
- **知識庫同步**：`node sync-knowledge-base.js` 同步 `knowledge-base.md` 到 `knowledge_base` 表（AI 使用）

---
## 詳細更新流程
A:手動操作
以下是賜安診所 LINE Bot 每月班表更新流程在 PowerShell 中需要執行的完整指令清單，依實際操作順序整理：
🔧 前置作業（檔案準備）
1. 開啟 schedule-input.txt  路徑：H:\opencode\linebot\schedule-input.txt
2. 從 Excel 複製當月份 Tab 格式班表 （第一行通常為「賜安診所115年9月班表」等）
3. 儲存檔案（必須是 UTF-8 無 BOM 編碼）
4. Build告訴我「貼好了」 → 我將執行 node append-schedule.js 附加班表到 knowledge-base.md

▶️ 步驟 1：產生全月班表圖（必須在 PowerShell 7 執行）
# 切換到專案目錄
cd H:\opencode\linebot
# 執行互動式腳本（會彈出視窗，請依畫面操作）
.\generate-schedule-image.ps1
✅ 輸出：schedule-full-YYYY-MM.jpg（例如：schedule-full-2026-09.jpg）
▶️ 步驟 2：產生週班表圖（可在一般 PowerShell 執行）
cd H:\opencode\linebot
node generate-weekly-schedules.js
✅ 輸出：schedule-YYYY-MM-week1.png ~ schedule-YYYY-MM-week6.png
▶️ 步驟 3：上傳班表圖片至 Supabase Storage（一般 PowerShell）
cd H:\opencode\linebot
node upload-schedule-images.js
✅ 上傳：所有存在的 schedule-*.png 和 schedule-full-*.jpg  
⚠️ 若某週圖檔尚未產生，會跳過並顯示警告（不影響執行）
▶️ 步驟 4：同步班表資料至資料庫（一般 PowerShell）
cd H:\opencode\linebot
node sync-schedule.js
✅ 讀取 knowledge-base.md 的班表內容，寫入 Supabase schedules 表

▶️ 步驟 5：知識庫同步（供 AI 使用）
cd H:\opencode\linebot
node sync-knowledge-base.js
此腳本將 knowledge-base.md 同步至 Supabase knowledge_base 表

B:一個半自動化批次執行程式
在 PowerShell 7 中執行：  cd H:\opencode\linebot  & .\run-monthly-schedule.bat


📦 後續建議操作（一般 PowerShell）
GitHub 備份
cd H:\opencode\linebot
git add .
git commit -m "月度更新: $(Get-Date -Format 'yyyy-MM')"
git push

LINE Bot 功能測試
- 在 LINE 中傳送「門診表」給 Bot，確認顯示當月份班表圖片
Supabase 檢查
1. 確認 schedules 表僅保留本月資料（如需清理重複可執行清理腳本）
2. 檢查 Storage 中的圖檔是否正確上傳

💡 重要提醒
- 目錄切換：所有指令請先執行 cd H:\opencode\linebot 確認在專案根目錄
- PowerShell 7 區別：只有 generate-schedule-image.ps1 必須在 PowerShell 7 中執行（因為它是互動式腳本，會彈出視窗）
- 其他腳本：可在一般 Windows PowerShell 或命令提示字元中執行
- 錯誤處理：若見「找不到節點」等錯誤，請先確認已安裝 Node.js 並將其加入系統 PATH
完整流程執行時間約 5-10 分鐘（依電腦效能而定），建議依序執行以上步驟。如有任何步驟失敗，請截圖錯誤訊息提供給我協助除錯。

---
## 驗證是否上傳成功
以下是在 PowerShell 中驗證「九月份班表圖片」及「schedules 資料表」是否上傳成功的完整指令序列。  
請依序貼上執行，每段會先設定環境變數，再呼叫 Supabase REST API。
1. 設定常用變數（只需執行一次）
$env:SUPABASE_URL = "https://kbpyxboleoefwvdnjcod.supabase.co"
$env:SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NjYyNCwiZXhwIjoyMDk3NDQyNjI0fQ.KS0GG_in6M6ZMr02WRhXx8L3URpnW2xgKdu5W7KIfa8"
$headers = @{ 
    apikey      = $env:SERVICE_KEY
    Authorization = "Bearer $env:SERVICE_KEY"
    "Content-Type" = "application/json"
}
2. 檢查 Supabase Storage（images 桶）是否存在九月份檔案
列出所有檔名（可直接觀察是否有 schedule-*-2026-09-*）
$body = @{
    limit    = 100
    offset   = 0
    prefix   = ""
    sortBy   = @{ column = "name"; order = "asc" }
} | ConvertTo-Json

Invoke-RestMethod -Uri "$env:SUPABASE_URL/storage/v1/object/list/images" `
                  -Headers $headers -Method Post -Body $body
預期輸出中應包含（依實際週數而定）：
- schedule-full-2026-09.jpg
- schedule-2026-09-week1.png
- schedule-2026-09-week2.png
- schedule-2026-09-week3.png
- schedule-2026-09-week4.png
- schedule-2026-09-week5.png
單獨檢查某個檔案是否可直接存取（回傳 200 表示存在）
# 範例：檢查全月圖
Invoke-WebRequest -Uri "$env:SUPABASE_URL/storage/v1/object/public/images/schedule-full-2026-09.jpg" `
                  -Method Head -Headers $headers -UseBasicParsing
若回應狀態碼為 200，則該檔案已成功上傳且可公開存取。  
同理可將網址換成其他週圖（例如 schedule-2026-09-week3.png）進行驗證。
3. 檢查 Supabase 資料表 schedules 是否已寫入九月份資料
Invoke-RestMethod -Uri "$env:SUPABASE_URL/rest/v1/schedules?select=*&year=eq.2026&month=eq.9" `
                  -Headers $headers -Method Get
預期結果：
- 會回傳多筆 JSON 物件（每筆對應一週），欄位包含 year=2026, month=9, week_number（1～6）、week_content、created_at 等。
- 若看到類似以下片段（內容可能因終端機編碼顯示為亂碼，但實際資料正確）：
year         : 2026
month        : 9
week_number  : 1
week_content : …（實際班表文字）
created_at   : 2026/08/28 02:38:44
則表示資料已正確寫入。
4. （選擇性）檢查資料表總筆數，確認無遺漏
Invoke-RestMethod -Uri "$env:SUPABASE_URL/rest/v1/schedules?select=count&year=eq.2026&month=eq.9" `
                  -Headers $headers -Method Get
回傳的 count 應為 22（含重複同步產生的備份記錄），或至少 6–7 唯一週號（依實際週數而定），表示九月份資料皆已存在。
完成上述檢查後，若所有指令皆能正常取得預期結果，即可確認：
- 九月份班表圖片已成功上傳至 Supabase Storage；
- 九月份班表資料已寫入 schedules 資料表；
- LINE Bot 在系統日期切到 2026‑09‑01 後，將自動顯示最新的九月份門診表。