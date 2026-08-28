$content = @'
@echo off
chcp 65001 >nul
setlocal

echo ===============================================
echo   班表更新流程（手動執行）
echo ===============================================
echo.

echo [步驟 1/5] 貼上新月份班表到 knowledge-base.md...
powershell -NoProfile -ExecutionPolicy Bypass -File "append-schedule-section.ps1"
if errorlevel 1 (
    echo 貼上班表失敗，請檢查錯誤訊息。
    pause
    exit /b 1
)
choice /C YN /M "步驟 1 完成，是否繼續？"
if errorlevel 2 (
    echo 您選擇了「否」，流程中止。
    pause
    exit /b 1
)

echo [步驟 2/5] 產生全月圖...
powershell -NoProfile -ExecutionPolicy Bypass -File "generate-schedule-image.ps1"
if errorlevel 1 (
    echo 產生全月圖失敗，請檢查錯誤訊息。
    pause
    exit /b 1
)
choice /C YN /M "步驟 2 完成，是否繼續？"
if errorlevel 2 (
    echo 您選擇了「否」，流程中止。
    pause
    exit /b 1
)

echo [步驟 3/5] 產生週圖...
node generate-weekly-schedules.js
if errorlevel 1 (
    echo 產生週圖失敗，請檢查錯誤訊息。
    pause
    exit /b 1
)
choice /C YN /M "步驟 3 完成，是否繼續？"
if errorlevel 2 (
    echo 您選擇了「否」，流程中止。
    pause
    exit /b 1
)

echo [步驟 4/5] 上傳圖檔至 Supabase...
node upload-schedule-images.js
if errorlevel 1 (
    echo 上傳圖檔失敗，請檢查錯誤訊息。
    pause
    exit /b 1
)
choice /C YN /M "步驟 4 完成，是否繼續？"
if errorlevel 2 (
    echo 您選擇了「否」，流程中止。
    pause
    exit /b 1
)

echo [步驟 5/5] 同步排程資料至資料庫...
node sync-schedule.js
if errorlevel 1 (
    echo 同步排程資料失敗，請檢查錯誤訊息。
    pause
    exit /b 1
)
choice /C YN /M "步驟 5 完成，是否結束？"
if errorlevel 2 (
    echo 您選擇了「否」，流程中止。
    pause
    exit /b 1
)

echo ===============================================
echo   班表更新流程全部完成！
echo ===============================================
pause
'@

[System.IO.File]::WriteAllText('H:\opencode\linebot\run-monthly-schedule.bat', $content.Replace("`n", "`r`n"), [System.Text.UTF8Encoding]::new($true))
