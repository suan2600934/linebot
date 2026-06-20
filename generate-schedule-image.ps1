# generate-schedule-image.ps1
# 從 Excel 班表生成圖檔（LINE 和 Facebook 共用）
# 並同步更新 knowledge-base.md

param(
    [Parameter(Mandatory=$false)]
    [string]$ExcelPath = "",

    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "H:\opencode\linebot\schedule-full-month.jpg"
)

$ErrorActionPreference = "Stop"

# 載入 config（如果存在）
$configPath = Join-Path $PSScriptRoot "facebook-upload\config.local.ps1"
$scheduleYear = "115"
if (Test-Path $configPath) {
    . $configPath
    if ($FacebookConfig.ScheduleYear) {
        $scheduleYear = $FacebookConfig.ScheduleYear
    }
}

# 如果沒指定 Excel 檔案，自動找最新的班表
if ($ExcelPath -eq "") {
    $excelPath = Get-ChildItem "H:\Gemini\pss\*$scheduleYear*.xlsx" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
    if ($excelPath -eq $null) {
        Write-Host "找不到 Excel 班表檔案（路徑：H:\Gemini\pss\*$scheduleYear*.xlsx）" -ForegroundColor Red
        exit 1
    }
} else {
    $excelPath = $ExcelPath
}

$outputDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   賜安診所班表圖檔生成工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Excel 檔案：$excelPath" -ForegroundColor Gray
Write-Host "輸出路徑：$OutputPath" -ForegroundColor Gray
Write-Host ""

Write-Host "啟動 Excel..." -ForegroundColor Cyan
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false

$scheduleData = @()  # 儲存班表資料

try {
    Write-Host "開啟檔案..." -NoNewline
    $workbook = $excel.Workbooks.Open($excelPath)
    Write-Host " OK" -ForegroundColor Green
    
    $worksheet = $workbook.Worksheets.Item(1)
    Write-Host "工作表：$($worksheet.Name)" -ForegroundColor Gray
    
    # 動態找出實際有內容的最後一列（只檢查 A 欄）
    $lastRow = 1
    for ($i = 1; $i -le 35; $i++) {
        $cellValue = $worksheet.Cells.Item($i, 1).Value2
        if ($cellValue -ne $null -and $cellValue.ToString().Trim() -ne "") {
            $lastRow = $i
        }
    }
    
    # 讀取班表資料
    # Excel 結構（每週 7 列）：
    # Row N: 第一週 + 週一～週日
    # Row N+1: (Col1空) 6/1, 6/2, 6/3...
    # Row N+2: 早診8:00~12:00 + 醫師
    # Row N+3: 午診3:00~6:00 + 醫師
    # Row N+4: 晚診6:30~8:30 + 醫師
    # Row N+5: (空白或分隔)
    # Row N+6: 第二週...
    # 
    # 欄位：Col1=時段標題, Col2-8=週一～週日
    Write-Host "讀取班表資料..." -NoNewline
    
    $monthStr = ""
    $scheduleByWeek = @()
    $currentWeek = $null
    $state = "none"  # none, dates, morning, afternoon, evening
    
    for ($row = 1; $row -le $lastRow; $row++) {
        $col1Value = $worksheet.Cells.Item($row, 1).Value2
        if ($col1Value -ne $null) { $col1Value = $col1Value.ToString().Trim() } else { $col1Value = "" }
        
        # 第 1 列是標題列（115年6月...）
        if ($row -eq 1 -and $col1Value -ne "") {
            $monthStr = $col1Value
            continue
        }
        
        # 判斷是否為「第X週」標題列
        if ($col1Value -match "^第[一二三四五]週") {
            if ($currentWeek -ne $null) {
                $scheduleByWeek += $currentWeek
            }
            $currentWeek = @{
                Header = $col1Value
                Dates = @()
                Morning = @()
                Afternoon = @()
                Evening = @()
            }
            $state = "weekHeader"
            continue
        }
        
        # 如果有當週資料
        if ($currentWeek -ne $null) {
            # 日期列：Col1 是空的，Col2-8 有日期
            if ($state -eq "weekHeader" -or ($col1Value -eq "" -and $currentWeek.Dates.Count -eq 0)) {
                $state = "dates"
                $currentWeek.Dates = @()
                for ($col = 2; $col -le 8; $col++) {
                    $val = $worksheet.Cells.Item($row, $col).Value2
                    if ($val -ne $null) { $val = $val.ToString().Trim() } else { $val = "" }
                    $currentWeek.Dates += $val
                }
                continue
            }
            
            # 早診列
            if ($col1Value -match "早診|8:00") {
                $state = "morning"
                $doctors = @()
                for ($col = 2; $col -le 8; $col++) {
                    $val = $worksheet.Cells.Item($row, $col).Value2
                    if ($val -ne $null) { $val = $val.ToString().Trim() } else { $val = "" }
                    $doctors += $val
                }
                $currentWeek.Morning = $doctors
                continue
            }
            
            # 午診列
            if ($col1Value -match "午診|15:00") {
                $state = "afternoon"
                $doctors = @()
                for ($col = 2; $col -le 8; $col++) {
                    $val = $worksheet.Cells.Item($row, $col).Value2
                    if ($val -ne $null) { $val = $val.ToString().Trim() } else { $val = "" }
                    $doctors += $val
                }
                $currentWeek.Afternoon = $doctors
                continue
            }
            
            # 晚診列
            if ($col1Value -match "晚診|18:30") {
                $state = "evening"
                $doctors = @()
                for ($col = 2; $col -le 8; $col++) {
                    $val = $worksheet.Cells.Item($row, $col).Value2
                    if ($val -ne $null) { $val = $val.ToString().Trim() } else { $val = "" }
                    $doctors += $val
                }
                $currentWeek.Evening = $doctors
                continue
            }
        }
    }
    
    # 加入最後一週
    if ($currentWeek -ne $null) {
        $scheduleByWeek += $currentWeek
    }
    Write-Host " OK" -ForegroundColor Green
    
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
    Write-Host "調整尺寸（1200px 寬）..." -NoNewline
    $newWidth = 1200
    $newHeight = [int]($bitmap.Height * ($newWidth / $bitmap.Width))
    
    $newBitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $graphics = [System.Drawing.Graphics]::FromImage($newBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($bitmap, 0, 0, $newWidth, $newHeight)
    
    # 儲存為 JPG
    $newBitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
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
    [System.GC]::WaitForPendingFinalizers()
    
} catch {
    Write-Host " FAIL" -ForegroundColor Red
    Write-Host "錯誤：$($_.Exception.Message)" -ForegroundColor Red
    try {
        [void]$workbook.Close($false)
        [void]$excel.Quit()
    } catch {}
    [System.GC]::Collect()
    exit 1
}

# 檢查圖片
if (Test-Path $OutputPath) {
    $image = Get-Item $OutputPath
    Write-Host ""
    Write-Host "✅ 圖片已生成！" -ForegroundColor Green
    Write-Host "  檔案：$($image.Name)"
    Write-Host "  大小：$([math]::Round($image.Length / 1KB, 2)) KB"
    
    try {
        $bitmap = New-Object System.Drawing.Bitmap($OutputPath)
        Write-Host "  尺寸：$($bitmap.Width) x $($bitmap.Height) 像素"
        $bitmap.Dispose()
    } catch {}
    
    Write-Host ""
    Write-Host "📍 圖檔位置：$OutputPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "可用於：" -ForegroundColor Yellow
    Write-Host "  1. LINE Bot 門診表查詢" -ForegroundColor Gray
    Write-Host "  2. Facebook 手動上傳" -ForegroundColor Gray
    
} else {
    Write-Host "❌ 圖片生成失敗" -ForegroundColor Red
    exit 1
}

# 更新 knowledge-base.md
Write-Host ""
Write-Host "更新 knowledge-base.md..." -ForegroundColor Cyan

$kbPath = Join-Path $PSScriptRoot "knowledge-base.md"
if (-not (Test-Path $kbPath)) {
    Write-Host "  找不到 knowledge-base.md，跳過更新" -ForegroundColor Yellow
} else {
    # 解析月份
    $monthMatch = [regex]::Match($monthStr, '(\d+)年(\d+)月')
    if ($monthMatch.Success) {
        $yearNum = $monthMatch.Groups[1].Value
        $monthNum = $monthMatch.Groups[2].Value
    } else {
        $yearNum = $scheduleYear
        $monthNum = "?"
    }
    
    # 產生 Markdown 格式的班表
    $scheduleMd = "## ${yearNum}年${monthNum}月門診班表`n`n"
    
    # 計算總天數
    $totalDays = 0
    foreach ($week in $scheduleByWeek) {
        $totalDays += $week.Dates.Count
    }
    
    # 星期幾的中文字尾
    $daySuffix = @("一", "二", "三", "四", "五", "六", "日")
    
    # 根據 scheduleByWeek 結構產生 markdown（每週為一個 table）
    $weekIndex = 0
    foreach ($week in $scheduleByWeek) {
        $weekIndex++
        
        # 過濾掉空白日期（只取有內容的）
        $validDates = $week.Dates | Where-Object { $_ -ne "" }
        
        if ($validDates.Count -eq 0) { continue }
        
        # 格式化日期：6月1日 → 6/1 + 星期
        $formattedDates = @()
        $dowIndex = 0
        foreach ($dateStr in $week.Dates) {
            if ($dateStr -and $dateStr -ne "") {
                # 從 "6月1日" 取出 "6/1"
                if ($dateStr -match '(\d+)月(\d+)日') {
                    $m = $matches[1]
                    $d = $matches[2]
                    $formattedDate = "$m/$d($($daySuffix[$dowIndex]))"
                } else {
                    $formattedDate = $dateStr
                }
                $formattedDates += $formattedDate
            }
            $dowIndex++
        }
        
        # 取得日期範圍（格式化後）
        $firstDate = $formattedDates[0]
        $lastDate = $formattedDates[$formattedDates.Count - 1]
        
        # 判斷是哪一週
        $weekName = switch ($weekIndex) {
            1 { "第一週" }
            2 { "第二週" }
            3 { "第三週" }
            4 { "第四週" }
            5 { "第五週" }
            default { "第$weekIndex 週" }
        }
        
        $scheduleMd += "### $weekName（$firstDate-$lastDate）`n"
        $scheduleMd += "| 日期 | 早診(8-12) | 午診(15-18) | 晚診(18:30-20:30) |`n"
        $scheduleMd += "|------|-----------|-------------|------------------|`n"
        
        # 每天都有一列
        for ($d = 0; $d -lt $formattedDates.Count; $d++) {
            $dateStr = $formattedDates[$d]
            $morning = if ($week.Morning[$d]) { $week.Morning[$d] } else { "" }
            $afternoon = if ($week.Afternoon[$d]) { $week.Afternoon[$d] } else { "" }
            $evening = if ($week.Evening[$d]) { $week.Evening[$d] } else { "" }
            
            $scheduleMd += "| $dateStr | $morning | $afternoon | $evening |`n"
        }
        
        $scheduleMd += "`n"
    }
    
    # 讀取現有 knowledge-base.md
    $kbContent = Get-Content $kbPath -Raw -Encoding UTF8
    $kbLines = $kbContent -split "`n"
    
    # 找出班表區間（從 "## {年份}年{月份}月門診班表" 到 "## 附近藥局資訊"）
    $startIdx = -1
    $endIdx = -1
    $targetHeader = "## ${yearNum}年${monthNum}月門診班表"
    
    for ($i = 0; $i -lt $kbLines.Count; $i++) {
        $line = $kbLines[$i].Trim()
        if ($line -eq $targetHeader) {
            $startIdx = $i
        }
        if ($startIdx -ge 0 -and $line -eq "## 附近藥局資訊") {
            $endIdx = $i
            break
        }
    }
    
    # 如果找到區間，取代它
    if ($startIdx -ge 0) {
        # 產生新的班表（格式化為多行）
        $scheduleLines = $scheduleMd -split "`n"
        
        if ($endIdx -gt $startIdx) {
            # 有結束標記，取代區間
            $newKbLines = @()
            for ($i = 0; $i -lt $startIdx; $i++) {
                $newKbLines += $kbLines[$i]
            }
            $newKbLines += $scheduleLines
            for ($i = $endIdx; $i -lt $kbLines.Count; $i++) {
                $newKbLines += $kbLines[$i]
            }
            $kbContent = $newKbLines -join "`n"
        } else {
            # 沒有結束標記（舊班表在最底部），直接取代從 startIdx 到結尾
            $newKbLines = @()
            for ($i = 0; $i -lt $startIdx; $i++) {
                $newKbLines += $kbLines[$i]
            }
            $newKbLines += $scheduleLines
            $kbContent = $newKbLines -join "`n"
        }
    } else {
        # 找不到明確的月份標題，就在 "## 附近藥局資訊" 之前插入
        $scheduleMd = $scheduleMd + "`n`n"
        $kbContent = $kbContent -replace "(## 附近藥局資訊)", "$scheduleMd`$1"
    }
    
    # 更新「最後更新」日期
    $today = Get-Date -Format "yyyy-MM-dd"
    $kbContent = $kbContent -replace "(# 賜安診所 AI 知識庫[\s\S]*?最後更新：)\d{4}-\d{2}-\d{2}", "`$1$today"
    
    # 寫回檔案
    Set-Content -Path $kbPath -Value $kbContent -Encoding UTF8
    Write-Host "  ✅ knowledge-base.md 已更新" -ForegroundColor Green
    Write-Host "    月份：${yearNum}年${monthNum}月" -ForegroundColor Gray
    Write-Host "    週次：$($scheduleByWeek.Count) 週" -ForegroundColor Gray
    Write-Host "    總天數：$totalDays 天" -ForegroundColor Gray
}