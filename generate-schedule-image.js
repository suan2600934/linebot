// generate-schedule-image.js
// 從 knowledge-base.md 讀取班表，繪製模擬 Excel 截圖風格的整月班表圖
// 替代損壞的 generate-schedule-image.ps1

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const CELL_W = 118;
const CELL_H = 45;
const LABEL_W = 100;
const DAYS = ['一', '二', '三', '四', '五', '六', '日'];

function parseKnowledgeBase(content) {
  const lines = content.split(/\r?\n/);
  const months = [];
  let i = 0;

  while (i < lines.length) {
    const m = lines[i].match(/^## +(\d+)年(\d+)月/);
    if (!m) { i++; continue; }
    const rocYear = parseInt(m[1]);
    const rocMonth = parseInt(m[2]);
    const westYear = 1911 + rocYear;
    const weeks = [];
    i++;

    while (i < lines.length) {
      const l = lines[i];
      if (/^## /.test(l)) break;

      if (/^第[一二三四五六]週/.test(l)) {
        const h = l.split('\t').map(c => c.trim());
        const label = h[0];
        i++;
        if (i >= lines.length) break;
        const dates = lines[i].split('\t').map(c => c.trim()).filter(c => /\d+月\d+日/.test(c));
        i++;
        const morning  = lines[i] ? lines[i].split('\t').map(c => c.trim()) : [];
        i++;
        const afternoon = lines[i] ? lines[i].split('\t').map(c => c.trim()) : [];
        i++;
        const evening = lines[i] ? lines[i].split('\t').map(c => c.trim()) : [];
        i++;
        weeks.push({ label, dates, morning, afternoon, evening });
      } else {
        i++;
      }
    }
    months.push({ rocYear, rocMonth, westYear, weeks });
  }
  return months;
}

function drawSchedule(month) {
  const title = `賜安診所${month.rocYear}年${month.rocMonth}月班表`;
  const colCount = 7;
  const totalW = LABEL_W + colCount * CELL_W;
  let h = 100;
  month.weeks.forEach(() => { h += CELL_H * 3 + 8; });
  h += 40;

  const canvas = createCanvas(totalW, h);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, totalW, h);

  // 標題
  ctx.font = 'bold 30px "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.fillText(title, totalW / 2, 55);

  let y = 90;

  function cell(x, y, w, h, text, bg, fg) {
    ctx.strokeStyle = '#aaa';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); }
    if (text) {
      ctx.fillStyle = fg || '#000';
      ctx.font = 'bold 16px "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
    }
  }

  month.weeks.forEach((week) => {
    const dates = week.dates;
    const morn = week.morning.slice(1);
    const aft = week.afternoon.slice(1);
    const eve = week.evening.slice(1);

    // date row
    cell(0, y, LABEL_W, CELL_H, week.label, '#dae1f2');
    for (let c = 0; c < dates.length; c++) {
      const d = dates[c];
      const show = d ? d.replace('月', '/').replace('日', '') + '(' + DAYS[c] + ')' : '';
      cell(LABEL_W + c * CELL_W, y, CELL_W, CELL_H, show, '#dae1f2');
    }
    y += CELL_H;

    // morning
    cell(0, y, LABEL_W, CELL_H, '早診', '#f5f5f5');
    for (let c = 0; c < dates.length; c++) {
      const doc = morn[c] ? morn[c].trim() : '';
      cell(LABEL_W + c * CELL_W, y, CELL_W, CELL_H, doc, '#fff', '#0066cc');
    }
    y += CELL_H;

    // afternoon
    cell(0, y, LABEL_W, CELL_H, '午診', '#f5f5f5');
    for (let c = 0; c < dates.length; c++) {
      const doc = aft[c] ? aft[c].trim() : '';
      cell(LABEL_W + c * CELL_W, y, CELL_W, CELL_H, doc, '#fff', '#cc0000');
    }
    y += CELL_H;

    // evening
    cell(0, y, LABEL_W, CELL_H, '晚診', '#f5f5f5');
    for (let c = 0; c < dates.length; c++) {
      const doc = eve[c] ? eve[c].trim() : '';
      cell(LABEL_W + c * CELL_W, y, CELL_W, CELL_H, doc, '#fff', '#008800');
    }
    y += CELL_H + 8;
  });

  return canvas.toBuffer('image/jpeg', { quality: 0.9 });
}

function main() {
  console.log('========================================');
  console.log('   賜安診所整月班表圖檔生成工具 (Node版)');
  console.log('========================================\n');

  const kbPath = path.join(__dirname, 'knowledge-base.md');
  if (!fs.existsSync(kbPath)) {
    console.error('找不到 knowledge-base.md');
    process.exit(1);
  }

  const content = fs.readFileSync(kbPath, 'utf8');
  const months = parseKnowledgeBase(content);
  if (!months.length) {
    console.error('找不到班表資料');
    process.exit(1);
  }

  const latest = months[months.length - 1];
  console.log(`月份：${latest.rocYear}年${latest.rocMonth}月`);
  console.log(`週數：${latest.weeks.length} 週\n`);

  const buffer = drawSchedule(latest);

  const filename = `schedule-full-${latest.westYear}-${String(latest.rocMonth).padStart(2,'0')}.jpg`;
  const outPath = path.join(__dirname, filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ 已輸出：${filename}\n`);
}

try {
  main();
} catch (err) {
  console.error('錯誤：', err);
  process.exit(1);
}