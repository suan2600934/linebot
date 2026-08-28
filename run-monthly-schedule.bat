@echo off
chcp 65001 >nul
setlocal

echo ===============================================
echo   ?剛”?湔瘚?嚗??銵?
echo ===============================================
echo.

echo [甇仿? 1/5] 鞎潔??唳?隞賜銵典 knowledge-base.md...
powershell -NoProfile -ExecutionPolicy Bypass -File "append-schedule-section.ps1"
if errorlevel 1 (
    echo 鞎潔??剛”憭望?嚗?瑼Ｘ?航炊閮??    pause
    exit /b 1
)
choice /C YN /M "甇仿? 1 摰?嚗?衣匱蝥?"
if errorlevel 2 (
    echo ?券?????瘚?銝剜迫??    pause
    exit /b 1
)

echo [甇仿? 2/5] ?Ｙ??冽???..
powershell -NoProfile -ExecutionPolicy Bypass -File "generate-schedule-image.ps1"
if errorlevel 1 (
    echo ?Ｙ??冽??仃??隢炎?仿隤方??胯?    pause
    exit /b 1
)
choice /C YN /M "甇仿? 2 摰?嚗?衣匱蝥?"
if errorlevel 2 (
    echo ?券?????瘚?銝剜迫??    pause
    exit /b 1
)

echo [甇仿? 3/5] ?Ｙ??勗?...
node generate-weekly-schedules.js
if errorlevel 1 (
    echo ?Ｙ??勗?憭望?嚗?瑼Ｘ?航炊閮??    pause
    exit /b 1
)
choice /C YN /M "甇仿? 3 摰?嚗?衣匱蝥?"
if errorlevel 2 (
    echo ?券?????瘚?銝剜迫??    pause
    exit /b 1
)

echo [甇仿? 4/5] 銝????Supabase...
node upload-schedule-images.js
if errorlevel 1 (
    echo 銝??憭望?嚗?瑼Ｘ?航炊閮??    pause
    exit /b 1
)
choice /C YN /M "甇仿? 4 摰?嚗?衣匱蝥?"
if errorlevel 2 (
    echo ?券?????瘚?銝剜迫??    pause
    exit /b 1
)

echo [甇仿? 5/5] ?郊??鞈??唾??澈...
node sync-schedule.js
if errorlevel 1 (
    echo ?郊??鞈?憭望?嚗?瑼Ｘ?航炊閮??    pause
    exit /b 1
)
choice /C YN /M "甇仿? 5 摰?嚗?衣???"
if errorlevel 2 (
    echo ?券?????瘚?銝剜迫??    pause
    exit /b 1
)

echo ===============================================
echo   ?剛”?湔瘚??券摰?嚗?echo ===============================================
pause