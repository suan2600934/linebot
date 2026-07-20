const https = require('https');
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTg2NjYyNCwiZXhwIjoyMDk3NDQyNjI0fQ.KS0GG_in6M6ZMr02WRhXx8L3URpnW2xgKdu5W7KIfa8';

const sql = `
-- 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Allow anon update services" ON public.services;

-- 建立允許 anon 更新 services 的政策
CREATE POLICY "Allow anon update services" ON public.services
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
`;

const postData = JSON.stringify({ sql });

const req = https.request({
  hostname: 'kbpyxboleoefwvdnjcod.supabase.co',
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();