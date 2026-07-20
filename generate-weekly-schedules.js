const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const OUTPUT_WIDTH = 1050;
const TOTAL_HEIGHT = 360;

const COLORS = {
  background: '#ffffff',
  headerBg: '#4a90d9',
  headerText: '#ffffff',
  dateBg: '#f0f0f0',
  dateText: '#333333',
  shiftBg: '#f5f5f5',
  morningBg: '#e8f4e8',
  afternoonBg: '#fff8e1',
  eveningBg: '#e8e8f4',
  gridLine: '#cccccc'
};

const DOCTOR_COLORS = {
  '周': '#0066cc',
  '鄭': '#cc0000',
  '石': '#008800'
};

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六'];

function parseKnowledgeBase(content) {
  const lines = content.split(/\r?\n/);

  const scheduleHeaders = [];
  lines.forEach((line, idx) => {
    if (line.match(/^## \d+年\d+月門診班表/)) {
      scheduleHeaders.push({ line: idx, text: line });
    }
  });

  if (scheduleHeaders.length < 1) {
    console.error('找不到月份班表區塊');
    return null;
  }

  const targetHeader = scheduleHeaders[scheduleHeaders.length - 1];
  const startIdx = targetHeader.line;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].match(/^## /)) {
      endIdx = i;
      break;
    }
  }

  const monthMatch = targetHeader.text.match(/(\d+)年(\d+)月/);
  const year = monthMatch[1];
  const month = monthMatch[2];

  const weeks = [];

  const blockLines = lines.slice(startIdx, endIdx);
  const blockText = blockLines.join('\n');

  if (blockText.includes('| 日期 |') && blockText.includes('|--')) {
    return parseMarkdownTableFormat(blockLines, year, month);
  } else {
    return parseTabFormat(blockLines, year, month);
  }
}

function parseMarkdownTableFormat(lines, year, month) {
  const weeks = [];
  let currentWeek = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '');

    const weekMatch = line.match(/^### 第([一二三四五六])週[（(].*?[）)]/);
    if (weekMatch) {
      if (currentWeek) {
        weeks.push(currentWeek);
      }
      currentWeek = {
        label: `第${weekMatch[1]}週`,
        dates: [],
        morning: [],
        afternoon: [],
        evening: []
      };
      continue;
    }

    if (line.startsWith('| 日期 |') || line.startsWith('|------')) {
      continue;
    }

    if (line.startsWith('|') && currentWeek) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim());

      if (cells.length >= 4) {
        currentWeek.dates.push(cells[0]);
        currentWeek.morning.push(cells[1] || '');
        currentWeek.afternoon.push(cells[2] || '');
        currentWeek.evening.push(cells[3] || '');
      }
    }
  }

  if (currentWeek) {
    weeks.push(currentWeek);
  }

  return { year, month, weeks };
}

function parseTabFormat(lines, year, month) {
  const weeks = [];
  let currentWeek = null;
  let state = 'none';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '');
    const parts = line.split('\t');

    if (line.match(/^賜安診所/)) continue;

    if (parts[0]?.trim().match(/^第[一二三四五六]週$/)) {
      if (currentWeek) {
        weeks.push(currentWeek);
      }
      currentWeek = {
        label: parts[0].trim(),
        dates: [],
        morning: [],
        afternoon: [],
        evening: []
      };
      state = 'weekHeader';
      continue;
    }

    if (currentWeek) {
      if (state === 'weekHeader' || (parts[0]?.trim() === '' && currentWeek.dates.length === 0)) {
        state = 'dates';
        for (let col = 1; col < parts.length; col++) {
          currentWeek.dates.push(parts[col]?.trim() || '');
        }
        continue;
      }

      if (parts[0]?.match(/早診|8:00/)) {
        state = 'morning';
        for (let col = 1; col < parts.length; col++) {
          currentWeek.morning.push(parts[col]?.trim() || '');
        }
        continue;
      }

      if (parts[0]?.match(/午診|15:00/)) {
        state = 'afternoon';
        for (let col = 1; col < parts.length; col++) {
          currentWeek.afternoon.push(parts[col]?.trim() || '');
        }
        continue;
      }

      if (parts[0]?.match(/晚診|18:30/)) {
        state = 'evening';
        for (let col = 1; col < parts.length; col++) {
          currentWeek.evening.push(parts[col]?.trim() || '');
        }
        continue;
      }
    }
  }

  if (currentWeek) {
    weeks.push(currentWeek);
  }

  return { year, month, weeks };
}

function drawWeekSchedule(weekData, year, month, weekIndex) {
  const canvas = createCanvas(OUTPUT_WIDTH, TOTAL_HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, OUTPUT_WIDTH, TOTAL_HEIGHT);

  const headerWidth = 90;
  const headerHeight = 40;
  const headerY = 10;

  ctx.fillStyle = COLORS.headerBg;
  ctx.fillRect(0, headerY, headerWidth, headerHeight);

  ctx.fillStyle = COLORS.headerText;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`第${WEEK_LABELS[weekIndex]}週`, headerWidth / 2, headerY + headerHeight / 2);

  const dayWidth = (OUTPUT_WIDTH - headerWidth) / 7;
  const dateRowHeight = 50;
  const shiftRowHeight = 80;
  const dateY = headerY + headerHeight + 5;
  const shiftsY = dateY + dateRowHeight + 5;

  for (let i = 0; i < 7; i++) {
    const x = headerWidth + i * dayWidth;
    const dateStr = weekData.dates[i] || '';

    ctx.fillStyle = COLORS.dateBg;
    ctx.fillRect(x, dateY, dayWidth, dateRowHeight);

    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, dateY, dayWidth, dateRowHeight);

    ctx.fillStyle = COLORS.dateText;
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dateStr, x + dayWidth / 2, dateY + dateRowHeight / 2);
  }

  const shifts = [
    { data: weekData.morning, bgColor: COLORS.morningBg },
    { data: weekData.afternoon, bgColor: COLORS.afternoonBg },
    { data: weekData.evening, bgColor: COLORS.eveningBg }
  ];

  shifts.forEach((shift, shiftIdx) => {
    const y = shiftsY + shiftIdx * shiftRowHeight;

    for (let i = 0; i < 7; i++) {
      const x = headerWidth + i * dayWidth;

      ctx.fillStyle = shift.bgColor;
      ctx.fillRect(x + 1, y, dayWidth - 2, shiftRowHeight - 2);

      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y, dayWidth - 2, shiftRowHeight - 2);

      const doctor = shift.data[i] || '';
      const doctorColor = DOCTOR_COLORS[doctor] || '#333333';
      ctx.fillStyle = doctorColor;
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(doctor, x + dayWidth / 2, y + shiftRowHeight / 2);
    }
  });

  ctx.strokeStyle = COLORS.headerBg;
  ctx.lineWidth = 2;
  ctx.strokeRect(0.5, 0.5, OUTPUT_WIDTH - 1, TOTAL_HEIGHT - 1);

  return canvas;
}

async function main() {
  console.log('========================================');
  console.log('   賜安診所每週班表圖檔生成工具');
  console.log('========================================');
  console.log('');

  const kbPath = path.join(__dirname, 'knowledge-base.md');

  if (!fs.existsSync(kbPath)) {
    console.error('找不到 knowledge-base.md');
    process.exit(1);
  }

  const content = fs.readFileSync(kbPath, 'utf8');
  const scheduleData = parseKnowledgeBase(content);

  if (!scheduleData) {
    process.exit(1);
  }

  console.log(`找到月份：${scheduleData.year}年${scheduleData.month}月`);
  console.log(`週數：${scheduleData.weeks.length} 週`);
  console.log('');

  for (let i = 0; i < scheduleData.weeks.length; i++) {
    const week = scheduleData.weeks[i];
    const canvas = drawWeekSchedule(week, scheduleData.year, scheduleData.month, i);

    const outputPath = path.join(__dirname, `schedule-week${i + 1}.png`);
    const buffer = canvas.toBuffer('image/png');

    fs.writeFileSync(outputPath, buffer);

    const sizeKB = (buffer.length / 1024).toFixed(2);
    const validDays = week.dates.filter(d => d && d.trim() !== '').length;
    console.log(`✅ 第${WEEK_LABELS[i]}週（${validDays} 天）→ ${outputPath} (${sizeKB} KB)`);
  }

  console.log('');
  console.log('完成！');
  console.log('');
  console.log('下一步：');
  console.log('  1. 確認 schedule-week1.png ~ schedule-week6.png 圖片正確');
  console.log('  2. 上傳到 Supabase Storage');
}

main().catch(console.error);