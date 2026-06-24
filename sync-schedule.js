require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function syncSchedule() {
  const content = fs.readFileSync('./knowledge-base.md', 'utf8');
  const lines = content.split(/\r?\n/);

  const weeks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].replace(/\r/g, '');
    const parts = line.split('\t');

    // 第一列是「第N週」
    if (parts[0]?.trim().match(/^第[一二三四五]週$/)) {
      const weekLabel = parts[0].trim();
      const datesLine = lines[i + 1]?.replace(/\r/g, '') || '';
      const dateParts = datesLine.split('\t').slice(1).map(p => p.trim());
      const morningLine = lines[i + 2]?.replace(/\r/g, '') || '';
      const afternoonLine = lines[i + 3]?.replace(/\r/g, '') || '';
      const eveningLine = lines[i + 4]?.replace(/\r/g, '') || '';

      const getDoctors = line => line.split('\t').slice(1).map(p => p.trim()).filter(p => p);
      const days = ['一', '二', '三', '四', '五', '六', '日'];

      const shiftText = [
        `早診：${getDoctors(morningLine).map((d, idx) => `週${days[idx]}${d}`).join('、')}`,
        `午診：${getDoctors(afternoonLine).map((d, idx) => `週${days[idx]}${d}`).join('、')}`,
        `晚診：${getDoctors(eveningLine).map((d, idx) => `週${days[idx]}${d}`).join('、')}`
      ].join('\n');

      weeks.push({ label: weekLabel, dates: dateParts, content: shiftText });
      i += 5; // 跳過這週的5行，繼續找下一週
      continue;
    }
    i++;
  }

  console.log('找到', weeks.length, '週');

  const cnToNum = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5 };

  for (const w of weeks) {
    const num = cnToNum[w.label.replace('第', '').replace('週', '')];
    const { error } = await supabase
      .from('schedules')
      .insert({
        year: 2026,
        month: 6,
        week_number: num,
        week_label: w.label,
        week_content: w.content
      });

    if (error) {
      console.error(`${w.label} 寫入失敗:`, error.message);
    } else {
      console.log(`${w.label} (${w.dates[0]}-${w.dates[w.dates.length - 1]}) 已同步`);
    }
  }
}

syncSchedule().catch(console.error);