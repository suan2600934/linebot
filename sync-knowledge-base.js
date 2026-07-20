require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const content = fs.readFileSync('./knowledge-base.md', 'utf8');

supabase
  .from('knowledge_base')
  .upsert({ id: 1, content, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  .then(({ error }) => {
    if (error) {
      console.error('同步失敗:', error.message);
      process.exit(1);
    }
    console.log('已同步到 Supabase');
  })
  .catch(err => {
    console.error('同步失敗:', err.message);
    process.exit(1);
  });