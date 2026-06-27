-- 即時看診進度資料表
CREATE TABLE IF NOT EXISTS queue_status (
  id SERIAL PRIMARY KEY,
  date INTEGER,              -- 日期（民國年，例如 1150611）
  room INTEGER,              -- 診間代號（1）
  roomn TEXT,                -- 科別（內科）
  current_number INTEGER,     -- 目前看診號（NOW_SER / TEMP_RECNO）
  wait_count INTEGER,         -- 等候人數
  doctor_name TEXT,           -- 醫師姓名
  shift_type TEXT,            -- 早診/午診/晚診（推斷）
  last_updated TIMESTAMP,     -- 更新時間
  created_at TIMESTAMP DEFAULT NOW()
);

-- 允許匿名讀取（LINE Bot 使用）
ALTER TABLE queue_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous read" ON queue_status FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert" ON queue_status FOR INSERT TO anon WITH CHECK (true);