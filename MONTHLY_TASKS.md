# 賜安診所 LINE Bot 月底維護清單

## 每月月底工作

### 1. 取得新月份班表
從診所取得下個月的 Excel 班表（Tab 格式）

### 2. 更新 knowledge-base.md
將新月份班表寫入 `knowledge-base.md` 的班表區塊（Tab 格式）

### 3. 執行 PowerShell 生成完整月份班表圖檔
```powershell
cd H:\opencode\linebot
.\generate-schedule-image.ps1
```
- 圖檔 `schedule-full-month.jpg` 會預先產生，於當月最後一天再上傳到 Supabase Storage（使用 `upload-schedule-images.js`）

### 4. 檢查並編輯 knowledge-base.md
將班表區塊更新為 Tab 格式（非 markdown 表格）

### 5. 產生每週班表圖（根據 knowledge-base.md）
```bash
node generate-weekly-schedules.js
```
- 讀取 knowledge-base.md 中的 Tab 格式班表
- 自動產生 schedule-week1.png ~ schedule-week6.png
- 尺寸：1050 x 360 pixels
- 圖檔會預先產生，於當月最後一天再上傳到 Supabase Storage（使用 `upload-schedule-images.js`）

### 6. 同步知識庫到 Supabase
```bash
node sync-knowledge-base.js
```
- 同步 `knowledge-base.md` 到 `knowledge_base` 表（供 AI 使用）

### 7. 同步班表到 Supabase
```bash
node sync-schedule.js
```
- 同步 Tab 格式班表到 `schedules` 表

### 8. 更新 GitHub
```bash
cd H:\opencode\linebot
git add . && git commit -m "月度更新: YYYY-MM" && git push
```

### 9. 確認 LINE Bot 正常
- 傳「門診表」測試是否顯示新月份
- 傳「第四週」測試是否正確

---

## 每日可檢查的事項
- [ ] Zeabur 部署正常、Logs 無錯誤
- [ ] LINE Rich Menu 按鈕正常運作

## 臨時需要告知我的事項
- 更換 LINE Access Token
- 更新 Rich Menu 圖片
- 新增/修改醫師資料
- 修改門診時間或收費
- 更換 AI API Key

---

**最後更新**：2026-07-20