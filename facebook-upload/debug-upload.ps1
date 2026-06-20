$token = "EAASIk8UQj8MBRiBRKWLWFvhekaCeOrRVBLOZB1GjqBL17NN03f9AQCOhRzt0VBFncysWUqVyqXsoZCBHUZCaXTOZB8LHTlSEkodit905unFhZA6aQmX3CFCddYH8qxBvFao0EHvdUAXobE1SRpydkfYrtPP7JN413Ygvk6ld1qCLLPN5AbFnR6yC3yA6XJcUxPsutNt1ZBNbmFaZCB9bjrqFFPdl3bkkzBxdsiRhWgZD"
$pageId = "865296870210875"
$imagePath = "H:\Gemini\pss\facebook-upload\temp\班表.jpg"
$message = "Test post"

Write-Host "測試上傳到 Facebook..."
Write-Host "Token: $($token.Substring(0, 30))..."
Write-Host "Page ID: $pageId"
Write-Host "Image: $imagePath"

try {
    $form = @{
        access_token = $token
        message = $message
    }
    $form.Add('source', (Get-Item $imagePath))
    
    $response = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/$pageId/photos" -Method Post -Form $form -Verbose
    
    Write-Host "`n成功！" -ForegroundColor Green
    Write-Host "Post ID: $($response.id)"
} catch {
    Write-Host "`n失敗！" -ForegroundColor Red
    Write-Host "錯誤：$($_.Exception.Message)"
    if ($_.ErrorDetails.Message) {
        $error = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "錯誤代碼：$($error.error.code)"
        Write-Host "錯誤訊息：$($error.error.message)"
        Write-Host "錯誤類型：$($error.error.type)"
    }
}