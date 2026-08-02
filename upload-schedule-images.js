require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 從 knowledge-base.md 的最後一個班表標題偵測年月（與 sync-schedule.js 一致）
const kbContent = fs.readFileSync('./knowledge-base.md', 'utf8');
const headerMatch = kbContent.match(/^## (\d+)年(\d+)月門診班表/g) || [];
const lastHeader = headerMatch[headerMatch.length - 1];
if (!lastHeader) {
  console.error('[ERROR] knowledge-base.md 中找不到班表標題');
  process.exit(1);
}
const ym = lastHeader.match(/^## (\d+)年(\d+)月門診班表$/);
const westYear = parseInt(ym[1]) + 1911;
const month = ym[2].padStart(2, '0');
console.log(`偵測到班表月份：${westYear}-${month}`);

// 組成月份專屬的檔名 (最多 6 週)
const monthFiles = [];
for (let i = 1; i <= 6; i++) {
  monthFiles.push(`schedule-${westYear}-${month}-week${i}.png`);
}
monthFiles.push(`schedule-full-${westYear}-${month}.jpg`);

// 為了相容既有程式（仍使用 schedule-weekX.png、schedule-full-month.jpg），
// 也同時上傳一組通用名稱的檔案（會指向同一張檔案）
const genericFiles = [];
for (let i = 1; i <= 6; i++) {
  genericFiles.push(`schedule-week${i}.png`);
}
genericFiles.push('schedule-full-month.jpg');

// 合併兩組檔案清單（若同名檔案已存在，會以相同內容上傳，Supabase 會以 upsert 方式覆寫）
const files = [...new Set([...monthFiles, ...genericFiles])];

async function uploadAll() {
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`${file} 不存在，跳過上傳`);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    const contentType = file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const { data, error } = await supabase.storage
      .from('images')
      .upload(file, buffer, { contentType, upsert: true });

    if (error) {
      console.error(`${file} 上傳失敗:`, error.message);
    } else {
      console.log(`${file} 上傳成功`);
    }
  }
}

uploadAll().catch(console.error);
