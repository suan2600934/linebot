# 自動執行腳本
$excelPath = Get-ChildItem "H:\Gemini\pss\*11506*.xlsx" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
Write-Host "使用 Excel 檔案：$excelPath" -ForegroundColor Cyan
& ".\Upload-ExcelToFacebook.ps1" -ExcelPath $excelPath