$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open("H:\Gemini\pss\賜安診所11506班表.xlsx")
$worksheet = $workbook.Worksheets.Item(1)
Write-Host "工作表：" $worksheet.Name
$usedRange = $worksheet.UsedRange
Write-Host ("範圍：" + $usedRange.Rows.Count + " 列 x " + $usedRange.Columns.Count + " 欄")
$usedRange.Select()
Start-Sleep -Milliseconds 500
$workbook.Close($false)
$excel.Quit()
[System.GC]::Collect()
Write-Host "完成！"