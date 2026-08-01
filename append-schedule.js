const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'schedule-input.txt');
const kbPath = path.join(__dirname, 'knowledge-base.md');

if (!fs.existsSync(inputPath)) {
  console.error('[ERROR] schedule-input.txt 不存在');
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf-8').trim();
if (!raw) {
  console.error('[ERROR] schedule-input.txt 內容為空');
  process.exit(1);
}

if (!fs.existsSync(kbPath)) {
  console.error('[ERROR] knowledge-base.md 不存在');
  process.exit(1);
}

const inputLines = raw.split(/\r?\n/).filter(l => l.length > 0);

let monthLabel = '';
let bodyStart = 0;

for (let i = 0; i < inputLines.length; i++) {
  const m = inputLines[i].match(/(\d+)年(\d+)月/);
  if (m) {
    monthLabel = `${m[1]}年${m[2]}月`;
    bodyStart = i + 1;
    break;
  }
}
if (!monthLabel) {
  const dm = raw.match(/(\d+)月\d+日/);
  if (dm) {
    const rocYear = String(new Date().getFullYear() - 1911);
    monthLabel = `${rocYear}年${dm[1]}月`;
    bodyStart = 0;
  } else {
    console.error('[ERROR] 無法偵測月份');
    process.exit(1);
  }
}
console.log(`偵測到月份：${monthLabel}`);

const bodyLines = inputLines.slice(bodyStart);
const header = `## ${monthLabel}門診班表\n`;
const block = header + bodyLines.join('\n') + '\n';

let existing = fs.readFileSync(kbPath, 'utf-8');
const today = new Date().toISOString().slice(0, 10);

if (existing.includes('最後更新：')) {
  existing = existing.replace(/最後更新：.*/, `最後更新：${today}`);
} else {
  existing = existing.trimEnd() + `\n最後更新：${today}\n`;
}

const separator = '\n---\n\n';
const newContent = existing.trimEnd() + separator + block;

fs.writeFileSync(kbPath, newContent, 'utf-8');

console.log(`[OK] 班表已附加到 knowledge-base.md`);
console.log(`     最後更新：${today}`);
console.log(`     月份：${monthLabel}`);
console.log(`     內容行數：${bodyLines.length}`);
