require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function syncSchedule() {
  const content = fs.readFileSync('./knowledge-base.md', 'utf8');
  const lines = content.split('\n').map(l => l.replace(/\r/g, ''));

  // 只處理 knowledge-base.md 中「最後一個」月份班表區塊
  // （knowledge-base.md 會累積所有歷史月份，若不限制範圍會把舊月份週別
  //   一併寫入當月份，造成每個 week_number 重複兩筆）
  const headerRegex = /^## (\d+)年(\d+)月門診班表$/;
  let year, month, blockStart = -1;
  for (let j = lines.length - 1; j >= 0; j--) {
    const m = lines[j].match(headerRegex);
    if (m) {
      year = parseInt(m[1]) + 1911;
      month = parseInt(m[2]);
      blockStart = j;
      break;
    }
  }
  if (blockStart < 0) {
    console.error('[ERROR] 無法從 knowledge-base.md 偵測班表年月');
    process.exit(1);
  }
  let blockEnd = lines.length;
  for (let j = blockStart + 1; j < lines.length; j++) {
    if (lines[j].startsWith('## ')) {
      blockEnd = j;
      break;
    }
  }
  console.log(`偵測到班表：${year}年${String(month).padStart(2, '0')}月（knowledge-base.md 第 ${blockStart + 1}～${blockEnd} 行）`);

  const weeks = [];
  let i = 0;
  const dayMap = { '星期一': 0, '星期二': 1, '星期三': 2, '星期四': 3, '星期五': 4, '星期六': 5, '星期日': 6 };
  const daySuffix = ['一', '二', '三', '四', '五', '六', '日'];

  while (i < blockEnd) {
    if (i < blockStart) { i++; continue; }
    const line = lines[i].replace(/\r/g, '');
    const parts = line.split('\t');

    if (parts[0]?.trim().match(/^第[一二三四五六]週$/)) {
      const weekLabel = parts[0].trim();
      const datesLine = lines[i + 1]?.replace(/\r/g, '') || '';
      const morningLine = lines[i + 2]?.replace(/\r/g, '') || '';
      const afternoonLine = lines[i + 3]?.replace(/\r/g, '') || '';
      const eveningLine = lines[i + 4]?.replace(/\r/g, '') || '';

      const dateParts = datesLine.split('\t');

      // 從 header row（第1行）找出第一個星期
      const headerParts = parts;
      let firstDayIdx = 0;
      for (let col = 1; col < headerParts.length; col++) {
        const cell = headerParts[col].trim();
        if (dayMap[cell] !== undefined) {
          firstDayIdx = dayMap[cell];
          break;
        }
      }

      // 從 dates row 找出第一個日期（如 7月1日），做為資料起始欄位
      let dataStart = 1;
      for (let col = 1; col < dateParts.length; col++) {
        if (dateParts[col] && dateParts[col].match(/\d+月\d+日/)) {
          dataStart = col;
          break;
        }
      }

      const getDoctors = line => {
        const cells = line.split('\t').map(p => p.trim());
        return cells.slice(dataStart).filter(p => p);
      };

      const buildShift = doctorLine => {
        const docList = getDoctors(doctorLine);
        return docList.map((d, idx) => `週${daySuffix[(firstDayIdx + idx) % 7]}${d}`).join('、');
      };

      const shiftText = [
        `早診：${buildShift(morningLine)}`,
        `午診：${buildShift(afternoonLine)}`,
        `晚診：${buildShift(eveningLine)}`
      ].join('\n');

      weeks.push({ label: weekLabel, content: shiftText });
      i += 5;
      continue;
    }
    i++;
  }

  console.log('找到', weeks.length, '週');

  // 去重：同一個月內若出現重複週標題，只保留第一次
  const uniqueWeeks = [];
  const seenLabels = new Set();
  for (const w of weeks) {
    if (seenLabels.has(w.label)) {
      console.warn(`[WARN] knowledge-base.md 中出現重複週標題：${w.label}（已忽略後一次）`);
      continue;
    }
    seenLabels.add(w.label);
    uniqueWeeks.push(w);
  }

  const cnToNum = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };

  const { error: delError } = await supabase.from('schedules').delete().match({ year, month });
  if (delError) {
    console.error(`[ERROR] 清除 ${year}/${month} 舊班表失敗：`, delError.message);
    process.exit(1);
  }

  const insertedWeeks = new Set();

  for (const w of uniqueWeeks) {
    const num = cnToNum[w.label.replace('第', '').replace('週', '')];
    if (!num) {
      console.error(`${w.label} 週號解析失敗，已跳過`);
      continue;
    }
    if (insertedWeeks.has(num)) {
      console.warn(`[WARN] week_number ${num} 重複，已跳過 ${w.label}`);
      continue;
    }
    insertedWeeks.add(num);

    const { error } = await supabase
      .from('schedules')
      .insert({ year, month, week_number: num, week_label: w.label, week_content: w.content });

    if (error) {
      console.error(`${w.label} 寫入失敗:`, error.message);
    } else {
      console.log(`${w.label} 已同步`);
    }
  }

  console.log(`\n完成：${year}/${month} 共 ${insertedWeeks.size} 週已同步至 Supabase`);
}

syncSchedule().catch(console.error);