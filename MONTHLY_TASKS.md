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

**最後更新**：2026-08-01
