<#
.SYNOPSIS
    測試 Facebook Access Token 是否有效並查看權限

.DESCRIPTION
    此腳本用來驗證 Access Token 的有效性
    並顯示當前 Token 擁有的權限與目標資訊

.PARAMETER ConfigPath
    設定檔路徑（預設為同目錄下的 config.local.ps1）

.EXAMPLE
    .\Test-Token.ps1

.EXAMPLE
    .\Test-Token.ps1 -ConfigPath ".\my-config.ps1"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ConfigPath = "$PSScriptRoot\config.local.ps1"
)

# 載入設定
if (-not (Test-Path $ConfigPath)) {
    Write-Error "設定檔不存在：$ConfigPath"
    exit 1
}

. $ConfigPath

# 驗證必要設定
if ($FacebookConfig.AccessToken -eq "YOUR_ACCESS_TOKEN_HERE" -or [string]::IsNullOrEmpty($FacebookConfig.AccessToken)) {
    Write-Error "請在 $ConfigPath 中設定有效的 Access Token"
    exit 1
}

$baseUrl = $FacebookConfig.BaseUrl
$apiVersion = $FacebookConfig.ApiVersion
$token = $FacebookConfig.AccessToken

Write-Host "測試 Facebook Access Token`n" -ForegroundColor Cyan
Write-Host "API 版本：$apiVersion"
Write-Host "Token 前綴：$($token.Substring(0, [Math]::Min(20, $token.Length)))...`n"

try {
    # 1. 測試 Token 有效性並取得使用者資訊
    Write-Host "1. 檢查 Token 有效性..." -NoNewline
    $me = Invoke-RestMethod -Uri "$baseUrl/$apiVersion/me?access_token=$token"
    Write-Host " ✓" -ForegroundColor Green
    Write-Host "   使用者名稱：$($me.name)"
    Write-Host "   使用者 ID: $($me.id)`n"
    
    # 2. 檢查權限
    Write-Host "2. 檢查權限..." -NoNewline
    $permissions = Invoke-RestMethod -Uri "$baseUrl/$apiVersion/me/permissions?access_token=$token"
    Write-Host " ✓" -ForegroundColor Green
    
    if ($permissions.data) {
        Write-Host "   已授權的權限:" -ForegroundColor Gray
        foreach ($perm in $permissions.data | Where-Object { $_.status -eq 'granted' }) {
            Write-Host "     • $($perm.permission)" -ForegroundColor Green
        }
        
        $denied = $permissions.data | Where-Object { $_.status -eq 'declined' }
        if ($denied) {
            Write-Host "`n   未授權的權限:" -ForegroundColor Gray
            foreach ($perm in $denied) {
                Write-Host "     • $($perm.permission)" -ForegroundColor Red
            }
        }
    }
    Write-Host ""
    
    # 3. 檢查 Token 過期時間
    Write-Host "3. 檢查 Token 有效期間..." -NoNewline
    $debugToken = Invoke-RestMethod -Uri "$baseUrl/$apiVersion/debug_token?input_token=$token&access_token=$token"
    
    if ($debugToken.data) {
        Write-Host " ✓" -ForegroundColor Green
        $data = $debugToken.data
        
        if ($data.is_valid) {
            Write-Host "   狀態：有效" -ForegroundColor Green
        } else {
            Write-Host "   狀態：無效" -ForegroundColor Red
        }
        
        if ($data.expires_at) {
            $expires = [DateTimeOffset]::FromUnixTimeSeconds($data.expires_at).DateTime
            $now = Get-Date
            $daysLeft = ($expires - $now).Days
            
            Write-Host "   過期時間：$expires"
            if ($daysLeft -lt 0) {
                Write-Host "   剩餘天數：已過期！" -ForegroundColor Red
            } elseif ($daysLeft -lt 7) {
                Write-Host "   剩餘天數：$daysLeft 天（即將過期）" -ForegroundColor Yellow
            } else {
                Write-Host "   剩餘天數：$daysLeft 天" -ForegroundColor Green
            }
        }
        
        Write-Host "   App ID: $($data.app_id)"
        Write-Host "   使用者 ID: $($data.user_id)"
    }
    Write-Host ""
    
    # 4. 檢查目標（粉絲專頁或群組）
    if (-not [string]::IsNullOrEmpty($FacebookConfig.TargetId)) {
        Write-Host "4. 檢查目標：$($FacebookConfig.TargetId)..." -NoNewline
        
        try {
            $target = Invoke-RestMethod -Uri "$baseUrl/$apiVersion/$($FacebookConfig.TargetId)?access_token=$token&fields=name,about"
            Write-Host " ✓" -ForegroundColor Green
            Write-Host "   名稱：$($target.name)"
            if ($target.about) {
                Write-Host "   關於：$($target.about)"
            }
        } catch {
            Write-Host " ✗" -ForegroundColor Red
            Write-Host "   無法存取目標，請檢查："
            Write-Host "     - TargetId 是否正確"
            Write-Host "     - Token 是否有該目標的權限"
        }
    }
    
    # 5. 列出可存取的粉絲專頁（如果有 pages_manage_posts 權限）
    Write-Host "`n5. 列出可存取的粉絲專頁..." -NoNewline
    $pages = Invoke-RestMethod -Uri "$baseUrl/$apiVersion/me/accounts?access_token=$token&fields=name,id,access_token"
    
    if ($pages.data -and $pages.data.Count -gt 0) {
        Write-Host " ✓" -ForegroundColor Green
        foreach ($page in $pages.data) {
            Write-Host "   • $($page.name) (ID: $($page.id))"
        }
    } else {
        Write-Host " - 無可存取的粉絲專頁或未授權" -ForegroundColor Yellow
    }
    
    Write-Host "`n測試完成！" -ForegroundColor Green
    
} catch {
    Write-Host " ✗" -ForegroundColor Red
    Write-Error "測試失敗：$($_.Exception.Message)"
    
    if ($_.ErrorDetails.Message) {
        try {
            $error = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "`n錯誤詳情:" -ForegroundColor Yellow
            Write-Host "  代碼：$($error.error.code)"
            Write-Host "  訊息：$($error.error.message)"
            Write-Host "  類型：$($error.error.type)"
            
            if ($error.error.code -eq 190) {
                Write-Host "`n建議：Access Token 已過期或無效，請重新產生" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "原始錯誤：$($_.ErrorDetails.Message)"
        }
    }
    
    exit 1
}