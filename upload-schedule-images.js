require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// 取得當前年月，用於組合檔名（與 generate-schedule-image / generate-weekly-schedules 保持一致）
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

// 組成月份專屬的檔名 (最多 6 週)
const monthFiles = [];
for (let i = 1; i <= 6; i++) {
  monthFiles.push(`schedule-${currentYear}-${currentMonth}-week${i}.png`);
}
monthFiles.push(`schedule-full-${currentYear}-${currentMonth}.jpg`);

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
