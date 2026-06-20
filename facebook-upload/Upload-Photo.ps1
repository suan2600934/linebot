<#
.SYNOPSIS
    使用 Facebook Graph API 上傳照片到粉絲專頁或群組

.DESCRIPTION
    此腳本會將指定的照片檔案上傳到指定的 Facebook 粉絲專頁或群組
    支援附加文字說明

.PARAMETER Path
    照片檔案的完整路徑（支援 JPG, PNG, GIF）

.PARAMETER Message
    照片的文字說明（可選）

.PARAMETER ConfigPath
    設定檔路徑（預設為同目錄下的 config.local.ps1）

.EXAMPLE
    .\Upload-Photo.ps1 -Path "C:\Photos\test.jpg" -Message "測試照片"

.EXAMPLE
    .\Upload-Photo.ps1 -Path "image.png" -Message "無標題" -ConfigPath ".\my-config.ps1"

.NOTES
    需要先在 config.local.ps1 中設定 Access Token 與目標 ID
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    
    [Parameter(Mandatory = $false)]
    [string]$Message = "",
    
    [Parameter(Mandatory = $false)]
    [string]$ConfigPath = "$PSScriptRoot\config.local.ps1"
)

# 載入設定
if (-not (Test-Path $ConfigPath)) {
    Write-Error "設定檔不存在：$ConfigPath"
    Write-Host "請先複製 config.ps1 並命名為 config.local.ps1，然後填入設定值" -ForegroundColor Yellow
    exit 1
}

. $ConfigPath

# 驗證必要設定
if ($FacebookConfig.AccessToken -eq "YOUR_ACCESS_TOKEN_HERE" -or [string]::IsNullOrEmpty($FacebookConfig.AccessToken)) {
    Write-Error "請在 $ConfigPath 中設定有效的 Access Token"
    exit 1
}

if ([string]::IsNullOrEmpty($FacebookConfig.TargetId)) {
    Write-Error "請在 $ConfigPath 中設定 TargetId（粉絲專頁 ID 或群組 ID）"
    exit 1
}

# 驗證檔案是否存在
if (-not (Test-Path -LiteralPath $Path)) {
    Write-Error "檔案不存在：$Path"
    exit 1
}

# 取得完整路徑
$FullPath = Resolve-Path -LiteralPath $Path
$File = Get-Item -LiteralPath $FullPath

# 驗證檔案類型
$validExtensions = @('.jpg', '.jpeg', '.png', '.gif')
$extension = [System.IO.Path]::GetExtension($File.Name).ToLower()
if ($extension -notin $validExtensions) {
    Write-Error "不支援的檔案格式：$extension"
    Write-Host "支援的格式：$($validExtensions -join ', ')" -ForegroundColor Yellow
    exit 1
}

# 驗證檔案大小（最大 20MB）
$maxSize = 20MB
if ($File.Length -gt $maxSize) {
    Write-Error "檔案過大（$([math]::Round($File.Length / 1MB, 2)) MB），最大支援 20MB"
    exit 1
}

Write-Host "準備上傳照片..." -ForegroundColor Cyan
Write-Host "  檔案：$($File.Name)"
Write-Host "  大小：$([math]::Round($File.Length / 1KB, 2)) KB"
Write-Host "  目標：$($FacebookConfig.TargetId) ($($FacebookConfig.TargetType))"
if ($Message) {
    Write-Host "  說明：$Message"
}

try {
    # 建構 API URL
    $endpoint = switch ($FacebookConfig.TargetType.ToLower()) {
        "page"  { "/$($FacebookConfig.TargetId)/photos" }
        "group" { "/$($FacebookConfig.TargetId)/photos" }
        default { throw "不支援的目標類型：$($FacebookConfig.TargetType)" }
    }
    
    $url = "$($FacebookConfig.BaseUrl)/$($FacebookConfig.ApiVersion)$endpoint"
    
    # 準備表單資料
    $form = @{
        access_token = $FacebookConfig.AccessToken
        message      = $Message
    }
    
    # 新增檔案
    $form.Add('source', (Get-Item $FullPath))
    
    Write-Host "  上傳中..." -NoNewline
    
    # 發送請求
    $response = Invoke-RestMethod -Uri $url -Method Post -Form $form
    
    # 顯示結果
    Write-Host " 完成！" -ForegroundColor Green
    
    if ($response.id) {
        Write-Host "`n上傳成功！" -ForegroundColor Green
        Write-Host "  照片 ID: $($response.id)"
        Write-Host "  連結：https://www.facebook.com/photo.php?fbid=$($response.id)"
    } else {
        Write-Warning "上傳完成但未收到照片 ID"
        Write-Host "回應：$($response | ConvertTo-Json -Depth 5)"
    }
    
} catch {
    Write-Host " 失敗！" -ForegroundColor Red
    Write-Error "上傳失敗：$($_.Exception.Message)"
    
    if ($_.ErrorDetails.Message) {
        try {
            $error = $_.ErrorDetails.Message | ConvertTo-Json | ConvertFrom-Json
            Write-Host "`n錯誤詳情:" -ForegroundColor Yellow
            Write-Host "  錯誤代碼：$($error.error.code)"
            Write-Host "  訊息：$($error.error.message)"
            Write-Host "  類型：$($error.error.type)"
            
            # 提供常見錯誤的解決建議
            if ($error.error.code -eq 190) {
                Write-Host "`n提示：Access Token 可能已過期或無效" -ForegroundColor Yellow
            } elseif ($error.error.code -eq 200) {
                Write-Host "`n提示：權限不足，請檢查 App 權限設定" -ForegroundColor Yellow
            } elseif ($error.error.code -eq 803) {
                Write-Host "`n提示：目標 ID 不存在或無法存取" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "原始錯誤：$($_.ErrorDetails.Message)"
        }
    }
    
    exit 1
}