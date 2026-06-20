# 自動取得粉絲專頁 Token 並上傳班表

Write-Host "=== Facebook 班表自動上傳工具 ===" -ForegroundColor Cyan
Write-Host ""

# 步驟 1：產生用戶 Token（需要手動授權）
Write-Host "步驟 1: 請在 Graph API Explorer 產生用戶 Token" -ForegroundColor Yellow
Write-Host "  1. 前往 https://developers.facebook.com/tools/explorer/" -ForegroundColor Gray
Write-Host "  2. 選擇你的 App (Photo Uploader)" -ForegroundColor Gray
Write-Host "  3. 請求欄位輸入：/me" -ForegroundColor Gray
Write-Host "  4. 點擊「提交」並授權" -ForegroundColor Gray
Write-Host "  5. 複製頂部的 access_token" -ForegroundColor Gray
Write-Host ""

$userToken = Read-Host "請貼上用戶 access_token"
if ([string]::IsNullOrWhiteSpace($userToken)) {
    Write-Host "錯誤：需要用戶 Token" -ForegroundColor Red
    exit 1
}

# 步驟 2：取得粉絲專頁 Token
Write-Host "`n步驟 2: 取得粉絲專頁 Token..." -ForegroundColor Yellow
try {
    $accountsResponse = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/me/accounts?access_token=$userToken"
    
    if ($accountsResponse.data -and $accountsResponse.data.Count -gt 0) {
        $page = $accountsResponse.data | Where-Object { $_.name -eq "賜安診所" }
        
        if ($page) {
            $pageToken = $page.access_token
            Write-Host "  ✓ 找到粉絲專頁：賜安診所" -ForegroundColor Green
            Write-Host "  ✓ 粉絲專頁 ID: $($page.id)" -ForegroundColor Green
        } else {
            Write-Host "  ✗ 找不到賜安診所粉絲專頁" -ForegroundColor Red
            Write-Host "  可用的粉絲專頁：" -ForegroundColor Yellow
            $accountsResponse.data | ForEach-Object { Write-Host "    - $($_.name) ($($_.id))" }
            exit 1
        }
    } else {
        Write-Host "  ✗ 沒有找到任何粉絲專頁" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ 錯誤：$($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $error = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  錯誤代碼：$($error.error.code)" -ForegroundColor Red
        Write-Host "  錯誤訊息：$($error.error.message)" -ForegroundColor Red
    }
    exit 1
}

# 步驟 3：更新設定檔
Write-Host "`n步驟 3: 更新設定檔..." -ForegroundColor Yellow
$configPath = "$PSScriptRoot\config.local.ps1"
$configContent = Get-Content $configPath -Raw
$configContent = $configContent -replace 'AccessToken = ".*"', "AccessToken = `"$pageToken`""
$configContent | Set-Content $configPath -Encoding UTF8
Write-Host "  ✓ 已更新 config.local.ps1" -ForegroundColor Green

# 步驟 4：上傳照片
Write-Host "`n步驟 4: 上傳班表照片..." -ForegroundColor Yellow
$imagePath = "$PSScriptRoot\temp\班表.jpg"
$message = "📅 115 年 6 月醫師門診輪班表【班表會視需要隨時更動與更新】"

if (-not (Test-Path $imagePath)) {
    Write-Host "  ✗ 找不到圖片檔案：$imagePath" -ForegroundColor Red
    Write-Host "  請先執行 convert-and-upload.ps1 產生圖片" -ForegroundColor Yellow
    exit 1
}

try {
    $form = @{
        access_token = $pageToken
        message = $message
    }
    $form.Add('source', (Get-Item $imagePath))
    
    $response = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/865296870210875/photos" -Method Post -Form $form
    
    Write-Host "  ✓ 上傳成功！" -ForegroundColor Green
    Write-Host "  貼文 ID: $($response.id)" -ForegroundColor Cyan
    Write-Host "  連結：https://www.facebook.com/photo.php?fbid=$($response.id)" -ForegroundColor Cyan
} catch {
    Write-Host "  ✗ 上傳失敗：$($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        $error = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  錯誤代碼：$($error.error.code)" -ForegroundColor Red
        Write-Host "  錯誤訊息：$($error.error.message)" -ForegroundColor Red
    }
    exit 1
}

Write-Host "`n=== 完成！ ===" -ForegroundColor Green