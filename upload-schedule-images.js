require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const files = ['schedule-week1.png', 'schedule-week2.png', 'schedule-week3.png', 'schedule-week4.png', 'schedule-week5.png'];

async function uploadAll() {
  for (const file of files) {
    const filePath = path.join(__dirname, file);
    const buffer = fs.readFileSync(filePath);
    const { data, error } = await supabase.storage
      .from('images')
      .upload(file, buffer, { contentType: 'image/png', upsert: true });

    if (error) {
      console.error(`${file} 上傳失敗:`, error.message);
    } else {
      console.log(`${file} 上傳成功`);
    }
  }
}

uploadAll().catch(console.error);