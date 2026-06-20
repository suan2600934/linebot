@echo off
chcp 65001 >nul
powershell -Command "cd H:\Gemini\pss\facebook-upload; $files = Get-ChildItem -Path 'H:\Gemini\pss\' -Filter '*11506*.xlsx' | Sort-Object LastWriteTime -Descending; $latest = $files[0].FullName; Write-Host '使用檔案：' $latest; .\Upload-ExcelToFacebook.ps1 -ExcelPath $latest"
pause