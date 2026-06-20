# Facebook Graph API 檔案上傳範例

## 事前準備

### 1. 建立 Facebook App
1. 前往 https://developers.facebook.com
2. 點擊「我的應用程式」→「建立應用程式」
3. 選擇「商業」或「其他」用途
4. 填寫 App 名稱與聯絡資訊

### 2. 取得 App ID 與 App Secret
- 在 App Dashboard 中可找到 **App ID** 與 **App Secret**
- 請妥善保管，不要公開分享

### 3. 設定權限
根據需求新增以下權限：
- `pages_manage_posts` - 管理粉絲專頁貼文
- `pages_read_engagement` - 讀取粉絲專頁互動
- `groups_access_member_info` - 讀取群組成員資訊（需要審核）
- `publish_to_groups` - 發佈到群組（需要審核）

### 4. 取得 Access Token

**重要：必須先用私人帳號登入授權，然後交換成粉絲專頁 Token**

**步驟 1：用 Graph API Explorer 取得使用者 Token（快速測試）**
1. 前往 https://developers.facebook.com/tools/explorer/
2. 選擇你的 App
3. 點擊「產生 Access Token」（會跳出視窗請你用**私人帳號**登入）
4. 選擇權限：`pages_manage_posts`, `pages_read_engagement`
5. 點擊「產生」

**步驟 2：取得粉絲專頁專用的 Access Token**
```powershell
# 用步驟 1 的 token 換取頁面 token
GET https://graph.facebook.com/v18.0/me/accounts?access_token=YOUR_USER_TOKEN
```

回應範例：
```json
{
  "data": [
    {
      "name": "我的粉絲專頁",
      "id": "123456789",
      "access_token": "EAA...（這是頁面專用的長期 token）"
    }
  ]
}
```

**步驟 3：使用粉絲專頁 Token**
- 將回應中的 `access_token` 填入 `config.local.ps1`
- 將該頁面的 `id` 填入 `TargetId`
- 這個 token 預設長期有效（不會過期）

**正式流程（OAuth 2.0）：**
```
https://graph.facebook.com/{app-id}/v18.0/oauth/access_token?
  client_id={app-id}&
  redirect_uri={redirect-uri}&
  client_secret={app-secret}&
  code={code-from-auth}
```

### 5. 取得目標 ID
- **粉絲專頁 ID**：前往粉絲專頁→關於→Facebook ID
- **群組 ID**：前往群組→關於→群組 ID（或使用 `GET /me/groups`）

---

## 使用方式

### 基本設定
編輯 `config.ps1` 並填入你的設定：
```powershell
$FacebookConfig = @{
    AccessToken = "你的 access token"
    TargetId    = "粉絲專頁 ID 或群組 ID"
    TargetType  = "page"  # 或 "group"
}
```

### 上傳照片
```powershell
.\Upload-Photo.ps1 -Path "C:\Photos\image.jpg" -Message "這是測試照片"
```

### 上傳影片
```powershell
.\Upload-Video.ps1 -Path "C:\Videos\video.mp4" -Title "測試影片" -Description "影片說明"
```

### 批量上傳
```powershell
.\Upload-Batch.ps1 -Folder "C:\Photos\" -TargetType "page"
```

---

## 注意事項

1. **檔案大小限制**
   - 照片：最大 20MB
   - 影片：最大 4GB

2. **支援的格式**
   - 照片：JPG, PNG, GIF
   - 影片：MP4, MOV, AVI, MKV

3. **API 版本**
   - 目前範例使用 v18.0
   - Facebook 會定期更新 API 版本，請注意官方公告

4. **權限審核**
   - 群組相關功能需要 Facebook 審核
   - 粉絲專頁功能相對寬鬆
   - 測試階段建議先用自己的粉絲專頁測試

5. **錯誤處理**
   - 執行腳本時會顯示詳細的錯誤訊息
   - 常見錯誤：Token 過期、權限不足、目標不存在

---

## 除錯技巧

### 測試 Access Token
```powershell
# 檢查 token 是否有效
Invoke-RestMethod -Uri "https://graph.facebook.com/me?access_token=YOUR_TOKEN"
```

### 檢查權限
```powershell
# 查看當前 token 的權限
Invoke-RestMethod -Uri "https://graph.facebook.com/me/permissions?access_token=YOUR_TOKEN"
```

### 查看 API 版本
```powershell
# 查看可用版本
Invoke-RestMethod -Uri "https://graph.facebook.com/versions"
```

---

## 參考資源

- Graph API 文件：https://developers.facebook.com/docs/graph-api
- API Explorer：https://developers.facebook.com/tools/explorer/
- 權限參考：https://developers.facebook.com/docs/permissions
- 錯誤代碼：https://developers.facebook.com/docs/graph-api/guides/error-handling