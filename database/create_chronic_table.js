const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kbpyxboleoefwvdnjcod.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImticHl4Ym9sZW9lZnd2ZG5qY29kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImltMCI6MTc0MDU1NDQwMH0.H9nJJPgYbBbKqxfLSRjSRxqs1eLq0c1h4E9xOQO1R0w';

const supabase = createClient(supabaseUrl, serviceKey);

async function setup() {
  console.log('建立 chronic_prescriptions_date 資料表...\n');

  // 1. 建立資料表
  const { error: tableErr } = await supabase.rpc('exec', {
    sql: `
      CREATE TABLE IF NOT EXISTS chronic_prescriptions_date (
        id              BIGSERIAL PRIMARY KEY,
        code            VARCHAR(10) NOT NULL,
        first_date      VARCHAR(10) NOT NULL,
        total_days      INTEGER NOT NULL,
        per_days        INTEGER NOT NULL,
        serno1_date     VARCHAR(10),
        serno2_date     VARCHAR(10),
        serno3_date     VARCHAR(10),
        expire_date     VARCHAR(10) NOT NULL,
        synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_chronic_prescriptions_date_code UNIQUE (code)
      );
    `
  });

  if (tableErr) {
    console.log('嘗試直接 SQL...');
    // Fallback: 用 raw SQL via REST
    const { error } = await supabase.from('chronic_prescriptions_date').select('code').limit(1);
    if (error && error.code === '42P01') {
      console.log('資料表不存在，需要手動建立');
    } else if (error) {
      console.log('錯誤:', error.message);
    } else {
      console.log('資料表已存在');
    }
  } else {
    console.log('資料表建立成功');
  }

  // 檢查
  const { data, error } = await supabase.from('chronic_prescriptions_date').select('code').limit(1);
  console.log('\n檢查結果:', error ? error.message : 'OK');

  console.log('\n請在 Supabase Dashboard SQL Editor 執行以下 SQL 建立資料表：');
  console.log(`
-- 在 Supabase Dashboard → SQL Editor 執行：

CREATE TABLE IF NOT EXISTS chronic_prescriptions_date (
  id              BIGSERIAL PRIMARY KEY,
  code            VARCHAR(10) NOT NULL,
  first_date      VARCHAR(10) NOT NULL,
  total_days      INTEGER NOT NULL,
  per_days        INTEGER NOT NULL,
  serno1_date     VARCHAR(10),
  serno2_date     VARCHAR(10),
  serno3_date     VARCHAR(10),
  expire_date     VARCHAR(10) NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_chronic_prescriptions_date_code UNIQUE (code)
);

-- 建立 RPC Function：
CREATE OR REPLACE FUNCTION chronic_prescriptions_date_upsert(
  p_code        VARCHAR(10),
  p_first_date  VARCHAR(10),
  p_total_days  INTEGER,
  p_per_days   INTEGER,
  p_serno1_date VARCHAR(10),
  p_serno2_date VARCHAR(10),
  p_serno3_date VARCHAR(10),
  p_expire_date VARCHAR(10)
) RETURNS void AS $$
BEGIN
  INSERT INTO chronic_prescriptions_date (
    code, first_date, total_days, per_days,
    serno1_date, serno2_date, serno3_date, expire_date
  ) VALUES (
    p_code, p_first_date, p_total_days, p_per_days,
    p_serno1_date, p_serno2_date, p_serno3_date, p_expire_date
  )
  ON CONFLICT (code) DO UPDATE SET
    first_date   = EXCLUDED.first_date,
    total_days   = EXCLUDED.total_days,
    per_days     = EXCLUDED.per_days,
    serno1_date  = EXCLUDED.serno1_date,
    serno2_date  = EXCLUDED.serno2_date,
    serno3_date  = EXCLUDED.serno3_date,
    expire_date  = EXCLUDED.expire_date,
    synced_at    = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`);
}

setup().catch(console.error);