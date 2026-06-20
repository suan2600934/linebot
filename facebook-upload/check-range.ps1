# 讀取 Excel 班表，確認左側範圍
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("H:\Gemini\pss\賜安診所 11506 班表.xlsx")
$worksheet = $workbook.Worksheets.Item(1)

Write-Host "工作表：$($worksheet.Name)" -ForegroundColor Cyan

$usedRange = $worksheet.UsedRange
Write-Host "總範圍：$($usedRange.Rows.Count) 列 x $($usedRange.Columns.Count) 欄" -ForegroundColor Green

Write-Host "`n左側班表 (A-G 欄) 內容：" -ForegroundColor Yellow
for ($i = 1; $i -le 30; $i++) {
    $row = ""
    for ($j = 1; $j -le 7; $j++) {
        $cell = $worksheet.Cells.Item($i, $j).Value2
        if ($cell -ne $null) {
            $row += "$cell`t"
        }
    }
    if ($row -ne "") {
        Write-Host "列 $i`: $row"
    }
}

[void]$workbook.Close($false)
[void]$excel.Quit()
[System.GC]::Collect()

Write-Host "`n建議選取範圍：A1 到 G30" -ForegroundColor Cyan