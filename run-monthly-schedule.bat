@echo off
chcp 65001 >nul
setlocal

echo ===============================================
echo   每月班表更新流程
echo ===============================================
echo.

echo [步驟 1/5] 準備貼上新月份班表到 schedule-input.txt...
echo.
echo 1. 開啟 H:\opencode\linebot\schedule-input.txt
echo 2. 從 Excel 複製本月份 Tab 格式班表貼入（第一行通常為「賜安診所115年9月班表」等）
echo 3. 儲存檔案（必須是 UTF-8 無 BOM）
echo 4. 儲存完成後，在此視窗按任意鍵繼續（我會執行 node append-schedule.js）
pause >nul

echo 正在執行 node append-schedule.js...
node append-schedule.js
if errorlevel 1 (
    echo 附加班表失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 1 完成，是否繼續?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo [步驟 2/5] 產生完整月份班表圖片...
pwsh -NoProfile -ExecutionPolicy Bypass -File "generate-schedule-image.ps1"
if errorlevel 1 (
    echo 產生班表圖片失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 2 完成，是否繼續?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo [步驟 3/5] 產生週別班表圖片...
node generate-weekly-schedules.js
if errorlevel 1 (
    echo 產生週別班表圖片失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 3 完成，是否繼續?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo [步驟 4/5] 上傳班表圖片至 Supabase...
node upload-schedule-images.js
if errorlevel 1 (
    echo 上傳班表圖片失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 4 完成，是否繼續?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo [步驟 5/5] 同步班表資料至資料庫...
node sync-schedule.js
if errorlevel 1 (
    echo 同步班表資料失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 5 完成，是否繼續?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo [步驟 6/6] 知識庫同步（供 AI 使用）...
node sync-knowledge-base.js
if errorlevel 1 (
    echo 知識庫同步失敗，請檢查錯誤訊息
    pause
    exit /b 1
)
choice /C YN /M "步驟 6 完成，是否結束?"
if errorlevel 2 (
    echo 已取消更新流程
    pause
    exit /b 1
)

echo ===============================================
echo   每月班表更新流程完成！
echo ===============================================
pause