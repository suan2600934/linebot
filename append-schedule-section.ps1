[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$kbPath = Join-Path $PSScriptRoot "knowledge-base.md"
if (-not (Test-Path $kbPath)) {
    Write-Host "❌ 找不到 knowledge-base.md，請確認檔案位置。" -ForegroundColor Red
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   新月份班表附加工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "請貼上要新增的班表 Markdown 內容（以 ###END### 結束）：" -ForegroundColor Yellow
Write-Host ""

$contentLines = @()
while ($true) {
    $line = Read-Host
    if ($line -eq "###END###") { break }
    $contentLines += $line
}

if ($contentLines.Count -eq 0) {
    Write-Host "❌ 未輸入任何內容，已取消。" -ForegroundColor Red
    exit 1
}

$content = $contentLines -join [Environment]::NewLine

$existing = Get-Content $kbPath -Raw -Encoding UTF8
$lines = $existing -split "`r?`n"

$today = Get-Date -Format "yyyy-MM-dd"

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "最後更新：") {
        $parts = $lines[$i] -split "最後更新：", 2
        $lines[$i] = $parts[0] + "最後更新：" + $today
        break
    }
}

$existingUpdated = $lines -join [Environment]::NewLine

$separator = [Environment]::NewLine + "---" + [Environment]::NewLine + [Environment]::NewLine

$newContent = $existingUpdated.TrimEnd() + $separator + $content + [Environment]::NewLine

Set-Content -Path $kbPath -Value $newContent -Encoding UTF8

Write-Host ""
Write-Host "✅ 已將新月份班表附加到 knowledge-base.md 最底部。" -ForegroundColor Green
Write-Host "  附加時間：$today" -ForegroundColor Gray
Write-Host ""
