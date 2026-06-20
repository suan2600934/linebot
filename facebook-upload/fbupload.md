# Facebook 班表上傳工具 - 工作紀錄

## 專案目的
自動化將 Excel 班表轉換為圖片並上傳到「賜安診所」Facebook 粉絲專頁。

---

## 已完成設定

### 1. Facebook 應用程式
- **App ID**: `1276068154609603`
- **應用程式名稱**: (已在 Facebook Developers 建立)
- **模式**: 開發中（僅管理員可使用）

### 2. 粉絲專頁資訊
- **粉絲專頁名稱**: 賜安診所
- **粉絲專頁 ID**: `865296870210875`
- **類別**: 醫院

### 3. Access Token
- **Token 類型**: 粉絲專頁專用 Access Token
- **權限**: 
  - `pages_manage_posts`
  - `pages_read_engagement`
  - `pages_show_list`
  - `business_management`
- **有效期**: 長期有效（需定期更新）

---

## 檔案結構

```
H:\Gemini\pss\facebook-upload\
├── config.ps1                      # 設定檔範本
├── config.local.ps1                # 本地設定（已填入賜安診所資訊）
├── Upload-Photo.ps1                # 照片上傳腳本
├── Upload-Video.ps1                # 影片上傳腳本
├── Test-Token.ps1                  # Token 測試腳本
├── convert-and-upload.ps1          # Excel 轉圖片並上傳（主要使用）
├── Upload-ExcelToFacebook.ps1      # Excel 上傳腳本（舊版）
├── run.ps1                         # 快速執行腳本
├── run.bat                         # 批次檔
├── README.md                       # 使用說明
├── SETUP-APP.md                    # Facebook App 建立教學
└── temp\                           # 暫存目錄
    └── 班表.jpg                    # 轉換後的班表圖片
```

---

## 使用流程

### 快速開始
```powershell
cd H:\Gemini\pss\facebook-upload
.\convert-and-upload.ps1
```

### 執行步驟
1. **開啟 Excel 班表** - 自動尋找最新的 `*11506*.xlsx` 檔案
2. **選取班表範圍** - 只選取 A1:G30（左側班表，不含右側統計）
3. **轉換為圖片** - 1200 像素寬度，適合 Facebook 顯示
4. **開啟預覽** - 自動開啟圖片讓你確認
5. **確認上傳** - 輸入 `Y` 上傳到 Facebook

### 貼文內容
```
📅 115 年 6 月醫師門診輪班表【班表會視需要隨時更動與更新】
```

---

## 獨立命令參考

### 測試 Token
```powershell
.\Test-Token.ps1
```

### 上傳照片（手動）
```powershell
.\Upload-Photo.ps1 -Path "C:\路徑\照片.jpg" -Message "貼文文字"
```

### 上傳影片
```powershell
.\Upload-Video.ps1 -Path "C:\路徑\影片.mp4" -Title "標題" -Description "說明"
```

---

## 技術細節

### Excel 處理
- 使用 Excel COM 物件（需要安裝 Microsoft Office）
- 選取範圍：`A1:G30`（第一週到第五週的班表）
- 複製為圖片格式
- 使用剪貼簿轉換

### 圖片規格
- **寬度**: 1200 像素
- **高度**: 自動比例計算
- **格式**: JPEG
- **品質**: 高品質雙立方插值

### Facebook API
- **API 版本**: v18.0
- **端點**: `/{page-id}/photos`
- **方法**: POST with multipart/form-data
- **參數**: 
  - `source`: 圖片檔案
  - `message`: 貼文文字
  - `access_token`: 粉絲專頁 Token

---

## 注意事項

### Token 更新
- 粉絲專頁 Token 通常長期有效
- 如果上傳失敗，可能是 Token 過期
- 重新產生 Token 步驟：
  1. 前往 https://developers.facebook.com/tools/explorer/
  2. 產生新的 Access Token（勾選 `pages_manage_posts`）
  3. 查詢 `/me/accounts` 取得新的頁面 Token
  4. 更新 `config.local.ps1` 中的 `AccessToken`

### Excel 檔案命名
- 腳本會自動尋找最新的 `*11506*.xlsx` 檔案
- 建議保持命名格式：`賜安診所 11506 班表.xlsx`

### 圖片範圍調整
- 目前設定為 `A1:G30`
- 如需調整，修改 `convert-and-upload.ps1` 第 33 行：
  ```powershell
  $range = $worksheet.Range("A1", "G30")
  ```

### 錯誤代碼參考
- **190**: Token 無效或過期
- **200**: 權限不足
- **803**: 目標 ID 不存在
- **136006**: 影片格式不支援

---

## 待辦事項

- [ ] 測試完整上傳流程
- [ ] 確認圖片範圍是否正確（A1:G30）
- [ ] 驗證 Facebook 貼文顯示效果
- [ ] 考慮加入 Hashtag 優化（如：`#賜安診所 #班表 #門診時間`）
- [ ] 建立排程自動化（每月自動上傳新班表）

---

## 聯絡資訊

- **開發者**: Julian Chou
- **粉絲專頁**: 賜安診所
- **最後更新**: 2026/6/14

---

## 相關資源

- [Facebook Graph API 文件](https://developers.facebook.com/docs/graph-api)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- [權限參考](https://developers.facebook.com/docs/permissions)
- [錯誤處理](https://developers.facebook.com/docs/graph-api/guides/error-handling)