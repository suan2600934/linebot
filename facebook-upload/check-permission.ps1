$token = "EAASIk8UQj8MBRhKNXlOJZC2ey5ZAb2ZB3WnKv4RtoWqPUENugZBv15tcQBkuZCoiT84gMySmSn6ZAdqm0bgGNoH1ZCSdvl5Ewty8lhUqn7DQMgUZCHCJVoi0TrAqnMRCcEKgtv5W9WH29zeL5WDXPJ2iO3qyoAK54P6Bp4hZAoomIwG9kbo9tKpHnpw6lpzcltYDHxMmlBlNizQeoL7QUognXvzOD1XCKqIc0c3avRjwlaD7z0asI1tTSVpryByJsooZBZAmSYjbwyPA3ZB2ZAvIt2Mf5"

Write-Host "檢查 Token 權限..."
try {
    $response = Invoke-RestMethod -Uri "https://graph.facebook.com/v18.0/me/permissions?access_token=$token"
    Write-Host "權限列表："
    $response.data | ForEach-Object {
        Write-Host "  - $($_.permission): $($_.status)"
    }
} catch {
    Write-Host "錯誤：$($_.Exception.Message)"
    $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "錯誤碼：$($errorDetails.error.code)"
    Write-Host "錯誤訊息：$($errorDetails.error.message)"
}