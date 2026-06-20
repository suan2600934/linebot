# 將 Excel 班表轉換為圖片並上傳到 Facebook
# 只選取左側班表範圍

param(
    [switch]$SkipConfirm
)

$ErrorActionPreference = "Stop"

. ".\config.local.ps1"

# 動態獲取最新的班表檔案（根據年份設定）
$excelPath = Get-ChildItem "H:\Gemini\pss\*$($FacebookConfig.ScheduleYear)*.xlsx" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
Write-Host "使用 Excel 檔案：$excelPath" -ForegroundColor Cyan

# 輸出到 LINE Bot 共用圖檔
$outputPath = "H:\opencode\linebot\schedule-full-month.jpg"
$outputDir = Split-Path $outputPath -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Write-Host "`n啟動 Excel..." -ForegroundColor Cyan
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false

try {
    Write-Host "開啟檔案..." -NoNewline
    $workbook = $excel.Workbooks.Open($excelPath)
    Write-Host " OK" -ForegroundColor Green
    
    $worksheet = $workbook.Worksheets.Item(1)
    Write-Host "工作表：$($worksheet.Name)" -ForegroundColor Gray
    
    # 動態找出實際有內容的最後一列（只檢查 A 欄）
    $lastRow = 1
    for ($i = 1; $i -le 30; $i++) {
        $cellValue = $worksheet.Cells.Item($i, 1).Value2
        if ($cellValue -ne $null -and $cellValue.ToString().Trim() -ne "") {
            $lastRow = $i
        }
    }
    
    # 只選取左側班表範圍：A1 到 H{lastRow}（動態範圍，不包含空白列）
    Write-Host "選取班表範圍 (A1:H$lastRow)..." -NoNewline
    $range = $worksheet.Range("A1", "H$lastRow")
    $range.Select()
    Write-Host " OK" -ForegroundColor Green
    
    # 複製為圖片
    Write-Host "複製為圖片..." -NoNewline
    $range.Copy()
    
    # 從剪貼簿取得圖片
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    $bitmap = [System.Windows.Forms.Clipboard]::GetImage()
    if ($bitmap -eq $null) {
        throw "無法從剪貼簿取得圖片"
    }
    Write-Host " OK" -ForegroundColor Green
    
    # 調整圖片尺寸（放大以填滿 Facebook 空間）
    Write-Host "調整尺寸..." -NoNewline
    $newWidth = 1200
    $newHeight = [int]($bitmap.Height * ($newWidth / $bitmap.Width))
    
    $newBitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($bitmap, 0, 0, $newWidth, $newHeight)
    
    # 儲存為 JPG
    $newBitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    Write-Host " OK" -ForegroundColor Green
    
    # 清理
    $graphics.Dispose()
    $bitmap.Dispose()
    $newBitmap.Dispose()
    [System.Windows.Forms.Clipboard]::Clear()
    
    [void]$workbook.Close($false)
    [void]$excel.Quit()
    
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($worksheet) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($workbook) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Error "錯誤：$($_.Exception.Message)"
    try {
        [void]$workbook.Close($false)
        [void]$excel.Quit()
    } catch {}
    [System.GC]::Collect()
    exit 1
}

# 檢查圖片
if (Test-Path $outputPath) {
    $image = Get-Item $outputPath
    Write-Host "`n✅ 圖片已建立：" -ForegroundColor Green
    Write-Host "  檔案：$($image.Name)"
    Write-Host "  大小：$([math]::Round($image.Length / 1KB, 2)) KB"
    
    try {
        $bitmap = New-Object System.Drawing.Bitmap($outputPath)
        Write-Host "  尺寸：$($bitmap.Width) x $($bitmap.Height) 像素"
        $bitmap.Dispose()
    } catch {}
    
    Write-Host "`n圖片位置：$outputPath" -ForegroundColor Cyan
    
    # 開啟圖片讓使用者確認
    Write-Host "開啟圖片預覽..." -ForegroundColor Cyan
    Start-Process $outputPath
    
    Start-Sleep -Seconds 2
    
    # 載入設定
    . ".\config.local.ps1"
    
    $message = "📅 115 年 6 月醫師門診輪班表【班表會視需要隨時更動與更新】"
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "Facebook 貼文預覽:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "粉絲專頁：賜安診所 ($($FacebookConfig.TargetId))"
    Write-Host "貼文內容：$message"
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "請確認圖片是否正確..." -ForegroundColor Yellow
    if ($SkipConfirm) {
        $confirm = "Y"
        Write-Host "已跳過確認，直接上傳" -ForegroundColor Cyan
    } else {
        $confirm = Read-Host "是否上傳到 Facebook？(Y/N)"
    }
    if ($confirm -eq "Y" -or $confirm -eq "y") {
        Write-Host "`n上傳中..." -ForegroundColor Cyan
        & ".\Upload-Photo.ps1" -Path $outputPath -Message $message
    } else {
        Write-Host "`n已取消上傳" -ForegroundColor Yellow
    }
    
} else {
    Write-Error "圖片建立失敗"
    exit 1
}