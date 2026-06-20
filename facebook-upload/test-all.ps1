# 測試不同的上傳方法

$token = "EAASIk8UQj8MBRiBRKWLWFvhekaCeOrRVBLOZB1GjqBL17NN03f9AQCOhRzt0VBFncysWUqVyqXsoZCBHUZCaXTOZB8LHTlSEkodit905unFhZA6aQmX3CFCddYH8qxBvFao0EHvdUAXobE1SRpydkfYrtPP7JN413Ygvk6ld1qCLLPN5AbFnR6yC3yA6XJcUxPsutNt1ZBNbmFaZCB9bjrqFFPdl3bkkzBxdsiRhWgZD"
$pageId = "865296870210875"
$imagePath = "H:\Gemini\pss\facebook-upload\temp\班表.jpg"

Write-Host "=== 測試 1：檢查 Token 有效性 ===" -ForegroundColor Cyan
try {
    $me = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/me?access_token=$token"
    Write-Host "Token 有效！" -ForegroundColor Green
    Write-Host "名稱：$($me.name)"
    Write-Host "ID: $($me.id)`n"
} catch {
    Write-Host "Token 無效！" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n=== 測試 2：檢查粉絲專頁存取權限 ===" -ForegroundColor Cyan
try {
    $page = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/$pageId?access_token=$token&fields=name,can_post"
    Write-Host "可以存取粉絲專頁！" -ForegroundColor Green
    Write-Host "名稱：$($page.name)"
    Write-Host "可以發文：$($page.can_post)`n"
} catch {
    Write-Host "無法存取粉絲專頁！" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`n=== 測試 3：檢查 App 狀態 ===" -ForegroundColor Cyan
try {
    $app = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/app?access_token=$token&fields=name,is_verified,development_mode"
    Write-Host "App 資訊：" -ForegroundColor Green
    Write-Host "名稱：$($app.name)"
    Write-Host "已驗證：$($app.is_verified)"
    Write-Host "開發模式：$($app.development_mode)`n"
} catch {
    Write-Host "無法取得 App 資訊（可能需要 App Access Token）" -ForegroundColor Yellow
}

Write-Host "`n=== 測試 4：嘗試上傳照片 ===" -ForegroundColor Cyan
try {
    $form = @{
        access_token = $token
        message = "測試發文"
    }
    $form.Add('source', (Get-Item $imagePath))
    
    $response = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/$pageId/photos" -Method Post -Form $form
    
    Write-Host "上傳成功！" -ForegroundColor Green
    Write-Host "貼文 ID: $($response.id)"
    Write-Host "連結：https://www.facebook.com/photo.php?fbid=$($response.id)"
} catch {
    Write-Host "上傳失敗！" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.ErrorDetails.Message) {
        $error = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "`n錯誤詳情:"
        Write-Host "  代碼：$($error.error.code)"
        Write-Host "  訊息：$($error.error.message)"
        Write-Host "  類型：$($error.error.type)"
    }
}