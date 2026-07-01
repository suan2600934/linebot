require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function syncSchedule() {
  const content = fs.readFileSync('./knowledge-base.md', 'utf8');
  const lines = content.split('\n').map(l => l.replace(/\r/g, ''));

  const weeks = [];
  let i = 0;
  const dayMap = { '星期一': 0, '星期二': 1, '星期三': 2, '星期四': 3, '星期五': 4, '星期六': 5, '星期日': 6 };
  const daySuffix = ['一', '二', '三', '四', '五', '六', '日'];

  while (i < lines.length) {
    const line = lines[i].replace(/\r/g, '');
    const parts = line.split('\t');

    if (parts[0]?.trim().match(/^第[一二三四五]週$/)) {
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

  const cnToNum = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5 };

  await supabase.from('schedules').delete().match({ year: 2026, month: 7 });

  for (const w of weeks) {
    const num = cnToNum[w.label.replace('第', '').replace('週', '')];
    const { error } = await supabase
      .from('schedules')
      .insert({ year: 2026, month: 7, week_number: num, week_label: w.label, week_content: w.content });

    if (error) {
      console.error(`${w.label} 寫入失敗:`, error.message);
    } else {
      console.log(`${w.label} 已同步`);
    }
  }
}

syncSchedule().catch(console.error);