# Facebook 應用程式建立詳細教學

## 步驟 1：進入 Facebook Developers

1. 前往：https://developers.facebook.com/
2. 用你的**私人 Facebook 帳號**登入
3. 點擊右上角 **「我的應用程式」**

---

## 步驟 2：建立應用程式

### 點擊「建立應用程式」

### 選擇應用程式類型
選擇 **「商業」**（最通用，適合粉絲專頁管理）

其他選項說明：
- **消費者**：針對一般用戶的 App
- **商業**：商業用途、行銷、粉絲專頁管理 ✓（推薦）
- **其他**：不屬於以上分類
- **遊戲**：遊戲類 App

---

## 步驟 3：填寫應用程式詳細資料

### 基本資訊頁面

| 欄位 | 填寫範例 | 說明 |
|------|----------|------|
| **應用程式名稱** | `Photo Uploader` 或 `粉絲團管理工具` | 任意取名，只有自己看得到（測試階段） |
| **應用程式聯絡電子郵件** | 你的 Gmail 或常用 Email | Facebook 會寄通知到這裡 |
| **Facebook 登入** | 選填 | 如果要讓別人用 FB 登入你的網站才需要 |

### 點擊「建立應用程式」

---

## 步驟 4：應用程式 Dashboard

建立完成後，會進入 Dashboard 頁面

### 左側選單重要項目：

#### 📊 **產品**
- **Graph API**：預設已啟用（不用設定）
- **Facebook 登入**：選填（只有要做網頁登入才需要）

#### ⚙️ **設定** → **基本設定**

這裡可以看到：
- **應用程式 ID**：就是 App ID（複製起來）
- **應用程式密碼**：點「顯示」後複製（App Secret）
- **應用程式圖示**：選填
- **隱私權政策 URL**：選填（測試階段可先不填）
- **服務條款 URL**：選填（測試階段可先不填）
- **使用者支援電郵**：選填（可填聯絡 Email）
- **應用程式網域**：選填（測試階段可先不填）
- **OAuth 重新導向 URI**：選填（步驟 4 才需要）
- **隱私設定**：
  - **應用程式模式**：開發中 / 正式
  - 預設是 **「開發中」**（只有自己能用）

---

## 步驟 5：應用程式模式（重要！）

### 開發中（預設）
- ✓ 只有你自己（管理員）可以使用
- ✓ 適合測試與開發
- ✓ 不用經過 Facebook 審核
- ✗ 無法給其他人使用

### 正式（上線）
- ✓ 所有人都可以使用
- ✗ 需要經過 Facebook 審核
- ✗ 需要填寫隱私權政策等資訊

**建議：** 先保持「開發中」，自己測試就好！

---

## 步驟 6：取得 App ID 與 App Secret

在 **設定** → **基本設定** 頁面：

1. 點擊 **應用程式密碼** 旁的「顯示」
2. 可能需要重新輸入密碼驗證
3. 複製 **應用程式 ID** 與 **應用程式密碼**

### 安全提醒：
- ⚠️ **App Secret 不能公開分享**
- ⚠️ 不要上傳到 GitHub 等公開平台
- ✓ 已加入 `.gitignore` 的 `config.local.ps1` 是安全的

---

## 步驟 7：用 Graph API Explorer 測試

### 不需要在自己的 App 中設定 OAuth！

1. 前往：https://developers.facebook.com/tools/explorer/
2. **應用程式** 下拉選單：選擇你剛建立的 App（可選，也可用預設）
3. **存取權杖**：點擊「產生存取權杖」
4. 選擇權限：
   - `pages_manage_posts` ✓
   - `pages_read_engagement` ✓
   - `public_profile` ✓（預設）
5. 點擊「產生」

### 產生 Token 後：
- 會跳出 Facebook 登入視窗（用你的私人帳號）
- 同意授權
- 取得一長串 Token

---

## 步驟 8：取得粉絲專頁 Access Token

### 在 Graph API Explorer 中測試：

**請求欄位輸入：**
```
/me/accounts
```

**點擊「送出」**

### 回應範例：
```json
{
  "data": [
    {
      "name": "我的粉絲專頁",
      "id": "123456789012345",
      "access_token": "EAAcZA...（很長的一串）"
    }
  ],
  "paging": {
    "cursors": {...}
  }
}
```

### 複製以下資訊：
- `access_token` → 填入 `config.local.ps1` 的 `AccessToken`
- `id` → 填入 `config.local.ps1` 的 `TargetId`

---

## 完整填寫範例

### config.local.ps1
```powershell
$FacebookConfig = @{
    AccessToken = "EAAcZAxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    TargetId    = "123456789012345"
    TargetType  = "page"
    ApiVersion  = "v18.0"
    BaseUrl     = "https://graph.facebook.com"
}
```

---

## 常見問題

### Q1: 應用程式名稱可以亂填嗎？
**A:** 測試階段可以，因為只有自己看得到。但如果要上線審核，名稱必須與實際功能相符。

### Q2: 隱私權政策 URL 一定要填嗎？
**A:** 測試階段（開發中模式）不需要。如果要上線審核才需要。

### Q3: 應用程式密碼忘記了怎麼辦？
**A:** 可以隨時在 Dashboard 重新產生新的。

### Q4: Token 過期了怎麼辦？
**A:** 
- 短期 Token：重新用 Graph API Explorer 產生
- 長期 Token（頁面 Token）：通常不會過期，如果過期就重新換一次

### Q5: 為什麼找不到我的粉絲專頁？
**A:** 
- 確認你是該粉絲專頁的**管理員**
- 確認已授權 `pages_manage_posts` 權限
- 試試重新產生 Token

---

## 下一步

完成設定後，回到專案目錄執行：

```powershell
cd H:\Gemini\pss\facebook-upload

# 1. 測試 Token
.\Test-Token.ps1

# 2. 上傳照片
.\Upload-Photo.ps1 -Path "C:\Photos\test.jpg" -Message "測試"
```

---

## 參考連結

- Facebook Developers：https://developers.facebook.com/
- Graph API Explorer：https://developers.facebook.com/tools/explorer/
- 應用程式 Dashboard：https://developers.facebook.com/apps/
- 權限參考：https://developers.facebook.com/docs/permissions