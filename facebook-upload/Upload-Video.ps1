<#
.SYNOPSIS
    使用 Facebook Graph API 上傳影片到粉絲專頁或群組

.DESCRIPTION
    此腳本會將指定的影片檔案上傳到指定的 Facebook 粉絲專頁或群組
    支援標題、說明等元資料
    影片上傳後會經過 Facebook 處理，可能需要幾分鐘才能觀看

.PARAMETER Path
    影片檔案的完整路徑（支援 MP4, MOV, AVI, MKV）

.PARAMETER Title
    影片標題（可選）

.PARAMETER Description
    影片詳細說明（可選）

.PARAMETER ConfigPath
    設定檔路徑（預設為同目錄下的 config.local.ps1）

.EXAMPLE
    .\Upload-Video.ps1 -Path "C:\Videos\demo.mp4" -Title "產品介紹" -Description "新產品功能展示"

.EXAMPLE
    .\Upload-Video.ps1 -Path "video.mov" -Title "活動紀錄"

.NOTES
    需要先在 config.local.ps1 中設定 Access Token 與目標 ID
    影片檔案最大支援 4GB
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    
    [Parameter(Mandatory = $false)]
    [string]$Title = "",
    
    [Parameter(Mandatory = $false)]
    [string]$Description = "",
    
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
$validExtensions = @('.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv')
$extension = [System.IO.Path]::GetExtension($File.Name).ToLower()
if ($extension -notin $validExtensions) {
    Write-Error "不支援的檔案格式：$extension"
    Write-Host "支援的格式：$($validExtensions -join ', ')" -ForegroundColor Yellow
    exit 1
}

# 驗證檔案大小（最大 4GB）
$maxSize = 4GB
if ($File.Length -gt $maxSize) {
    Write-Error "檔案過大（$([math]::Round($File.Length / 1GB, 2)) GB），最大支援 4GB"
    exit 1
}

Write-Host "準備上傳影片..." -ForegroundColor Cyan
Write-Host "  檔案：$($File.Name)"
Write-Host "  大小：$([math]::Round($File.Length / 1MB, 2)) MB"
Write-Host "  目標：$($FacebookConfig.TargetId) ($($FacebookConfig.TargetType))"
if ($Title) {
    Write-Host "  標題：$Title"
}
if ($Description) {
    Write-Host "  說明：$Description"
}

try {
    # 建構 API URL
    $endpoint = switch ($FacebookConfig.TargetType.ToLower()) {
        "page"  { "/$($FacebookConfig.TargetId)/videos" }
        "group" { "/$($FacebookConfig.TargetId)/videos" }
        default { throw "不支援的目標類型：$($FacebookConfig.TargetType)" }
    }
    
    $url = "$($FacebookConfig.BaseUrl)/$($FacebookConfig.ApiVersion)$endpoint"
    
    # 準備表單資料
    $form = @{
        access_token = $FacebookConfig.AccessToken
    }
    
    # 新增可選參數
    if ($Title) { $form.Add('title', $Title) }
    if ($Description) { $form.Add('description', $Description) }
    
    # 新增檔案
    $form.Add('source', (Get-Item $FullPath))
    
    Write-Host "  上傳中（這可能需要幾分鐘）..." -NoNewline
    
    # 發送請求（影片上傳較耗時）
    $response = Invoke-RestMethod -Uri $url -Method Post -Form $form -TimeoutSec 300
    
    # 顯示結果
    Write-Host " 完成！" -ForegroundColor Green
    
    if ($response.id) {
        Write-Host "`n上傳成功！" -ForegroundColor Green
        Write-Host "  影片 ID: $($response.id)"
        Write-Host "  連結：https://www.facebook.com/video.php?v=$($response.id)"
        Write-Host "`n注意：影片需要經過 Facebook 處理，可能需要幾分鐘後才能觀看" -ForegroundColor Yellow
    } else {
        Write-Warning "上傳完成但未收到影片 ID"
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
            } elseif ($error.error.code -eq 136006) {
                Write-Host "`n提示：影片格式不支援或檔案損毀" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "原始錯誤：$($_.ErrorDetails.Message)"
        }
    }
    
    exit 1
}