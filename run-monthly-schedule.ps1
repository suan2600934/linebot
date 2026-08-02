[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Ask-Continue {
  param([string]$Message)
  while ($true) {
    $ans = Read-Host "$Message (Y/N)"
    if ($ans -match '^[Yy]$') { return $true }
    if ($ans -match '^[Nn]$') { return $false }
  }
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " 班表更新流程（含互動提示）" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[步驟 1/5] 貼上新月份班表到 knowledge-base.md..." -ForegroundColor Cyan
Write-Host ""
Write-Host "請開啟 schedule-input.txt，從 Excel 複製 Tab 格式班表貼入" -ForegroundColor Yellow
Write-Host "（第一行通常為：賜安診所115年X月班表）" -ForegroundColor Gray
Write-Host "貼好存檔後，回來這裡按 Y 繼續。" -ForegroundColor Gray
Write-Host ""
if (-not (Ask-Continue "已貼上並存檔，是否繼續？")) {
  Write-Host ""
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}
Write-Host ""

node .\append-schedule.js
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ 貼上班表失敗，請確認 schedule-input.txt 內容後重試。" -ForegroundColor Red
  exit 1
}

Write-Host ""
if (-not (Ask-Continue "步驟 1 完成（班表已附加到 knowledge-base.md），是否繼續到步驟 2？")) {
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[步驟 2/5] 產生全月圖..." -ForegroundColor Cy an
Write-Host "正在開啟 PowerShell 7 視窗執行 generate-schedule-image.ps1..." -ForegroundColor Yellow
Write-Host "請在新的視窗中等待腳本執行完畢，關閉後回到這裡繼續。" -ForegroundColor Gray
Write-Host ""

Start-Process "pwsh" -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','.\generate-schedule-image.ps1' -Wait -NoNewWindow

Write-Host ""
if (-not (Ask-Continue "步驟 2 完成（全月圖已產生），是否繼續到步驟 3？")) {
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[步驟 3/5] 產生週圖..." -ForegroundColor Cyan
node .\generate-weekly-schedules.js
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ 產生週圖失敗，請檢查錯誤訊息。" -ForegroundColor Red
  exit 1
}
Write-Host ""
if (-not (Ask-Continue "步驟 3 完成（週圖已產生），是否繼續到步驟 4？")) {
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[步驟 4/5] 上傳圖檔至 Supabase..." -ForegroundColor Cyan
node .\upload-schedule-images.js
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ 上傳圖檔失敗，請檢查錯誤訊息。" -ForegroundColor Red
  exit 1
}
Write-Host ""
if (-not (Ask-Continue "步驟 4 完成（圖檔已上傳），是否繼續到步驟 5？")) {
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "[步驟 5/5] 同步排程資料至資料庫..." -ForegroundColor Cyan
node .\sync-schedule.js
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ 同步排程資料失敗，請檢查錯誤訊息。" -ForegroundColor Red
  exit 1
}
Write-Host ""
if (-not (Ask-Continue "步驟 5 完成，是否結束？")) {
  Write-Host "已中止流程。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host " 班表更新流程全部完成！" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
