# Facebook Graph API 設定檔
# 請將此檔案複製為 config.local.ps1 並填入真實資料
# config.local.ps1 不會被提交到版本控制

$FacebookConfig = @{
    # Facebook Access Token
    # 可從 Graph API Explorer 取得：https://developers.facebook.com/tools/explorer/
    AccessToken = "YOUR_ACCESS_TOKEN_HERE"
    
    # 目標 ID（粉絲專頁 ID 或群組 ID）
    # 粉絲專頁：前往粉絲專頁→關於→Facebook ID
    # 群組：前往群組→關於→群組 ID
    TargetId    = "YOUR_PAGE_OR_GROUP_ID"
    
    # 目標類型："page" 或 "group"
    TargetType  = "page"
    
    # API 版本（建議使用最新穩定版）
    ApiVersion  = "v18.0"
    
    # 基礎 URL（通常不需要修改）
    BaseUrl     = "https://graph.facebook.com"
}

# 載入設定時檢查是否為測試設定
if ($FacebookConfig.AccessToken -eq "YOUR_ACCESS_TOKEN_HERE") {
    Write-Warning "請先編輯 config.local.ps1 並填入真實的 Access Token"
    Write-Warning "複製範例：Copy-Item config.ps1 config.local.ps1"
}