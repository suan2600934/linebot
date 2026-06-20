<#
.SYNOPSIS
    將 Excel 班表轉換為圖片並上傳到 Facebook 粉絲專頁
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$ExcelPath = "H:\Gemini\pss\賜安診所 11506 班表.xlsx",
    
    [Parameter(Mandatory = $false)]
    [string]$OutputPath = "H:\Gemini\pss\facebook-upload\temp\班表.jpg",
    
    [Parameter(Mandatory = $false)]
    [string]$Message = "115 年 6 月醫師門診輪班表【班表會視需要隨時更動與更新】",
    
    [Parameter(Mandatory = $false)]
    [string]$ConfigPath = "$PSScriptRoot\config.local.ps1"
)

function Write-ErrorAndExit {
    param([string]$Message)
    Write-Host "錯誤：$Message" -ForegroundColor Red
    exit 1
}

Write-Host "檢查 Excel 安裝..." -NoNewline
try {
    $excel = New-Object -ComObject Excel.Application
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-ErrorAndExit "無法啟動 Excel，請確認已安裝 Microsoft Office"
}

if (-not (Test-Path $ExcelPath)) {
    Write-ErrorAndExit "找不到 Excel 檔案：$ExcelPath"
}

if (-not (Test-Path $ConfigPath)) {
    Write-ErrorAndExit "找不到 Facebook 設定檔：$ConfigPath"
}
. $ConfigPath

$outputDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Write-Host "`n處理 Excel 班表..." -ForegroundColor Cyan

try {
    $workbook = $excel.Workbooks.Open($ExcelPath)
    $worksheet = $workbook.Worksheets.Item(1)
    
    Write-Host "  工作表：$($worksheet.Name)" -ForegroundColor Gray
    
    $usedRange = $worksheet.UsedRange
    $lastRow = $usedRange.Rows.Count
    $lastCol = $usedRange.Columns.Count
    
    Write-Host "  範圍：第 1 列 - 第 $lastRow 列，第 1 欄 - 第 $lastCol 欄" -ForegroundColor Gray
    
    $startCell = $worksheet.Cells.Item(1, 1)
    $endCell = $worksheet.Cells.Item($lastRow, $lastCol)
    $range = $worksheet.Range($startCell, $endCell)
    
    $targetWidth = 1200
    $targetHeight = 900
    
    Write-Host "  複製為圖片..." -NoNewline
    [void]$range.CopyPicture(-4147, 1)
    Write-Host " OK" -ForegroundColor Green
    
    Write-Host "  貼上到圖表物件..." -NoNewline
    $chart = $workbook.Charts.Add()
    [void]$chart.Paste()
    $chart.Width = $targetWidth
    $chart.Height = $targetHeight
    Write-Host " OK" -ForegroundColor Green
    
    Write-Host "  匯出為 JPG..." -NoNewline
    $chart.Export($OutputPath, "JPG")
    Write-Host " OK" -ForegroundColor Green
    
    [void]$chart.Delete()
    [void]$workbook.Close($false)
    [void]$excel.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Error "處理 Excel 時發生錯誤：$($_.Exception.Message)"
    try {
        [void]$workbook.Close($false)
        [void]$excel.Quit()
    } catch {}
    [System.GC]::Collect()
    exit 1
}

if (-not (Test-Path $OutputPath)) {
    Write-ErrorAndExit "圖片匯出失敗"
}

$imageInfo = Get-Item $OutputPath
Write-Host "`n圖片資訊:" -ForegroundColor Cyan
Write-Host "  檔案：$($imageInfo.Name)"
Write-Host "  大小：$([math]::Round($imageInfo.Length / 1KB, 2)) KB"

try {
    $bitmap = New-Object System.Drawing.Bitmap($OutputPath)
    Write-Host "  尺寸：$($bitmap.Width) x $($bitmap.Height) 像素"
    $bitmap.Dispose()
} catch {
    Write-Host "  尺寸：無法讀取"
}

Write-Host "`n準備上傳到 Facebook..." -ForegroundColor Cyan
Write-Host "  粉絲專頁：$($FacebookConfig.TargetId)"
Write-Host "  貼文內容：$Message"

try {
    & "$PSScriptRoot\Upload-Photo.ps1" -Path $OutputPath -Message $Message -ConfigPath $ConfigPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n完成！班表已成功上傳到 Facebook" -ForegroundColor Green
    } else {
        Write-Host "`n圖片已建立，但上傳失敗" -ForegroundColor Yellow
        Write-Host "圖片位置：$OutputPath"
    }
    
} catch {
    Write-Error "上傳失敗：$($_.Exception.Message)"
    Write-Host "`n圖片已建立：$OutputPath" -ForegroundColor Yellow
    exit 1
}
