-- ============================================
-- 慢性病處方箋領藥資料表
-- 建立日期：2026-07-06
-- 更新週期：每 7 天（sync script 更新）
-- 用途：儲存病人最近一張慢連箋的領藥進度，供 LINE Bot 查詢回覆
-- ============================================

CREATE TABLE IF NOT EXISTS chronic_prescriptions_date (
  id              BIGSERIAL PRIMARY KEY,
  code            VARCHAR(10) NOT NULL,            -- 病歷號（6位）
  first_date      VARCHAR(10) NOT NULL,            -- 首次開立日期（民國，如 B00516）
  total_days      INTEGER NOT NULL,               -- 總天數（90 或 84）
  per_days        INTEGER NOT NULL,               -- 每次給藥天數（30 或 28）
  serno1_date     VARCHAR(10),                    -- 第1次領藥日期（NULL=未領）
  serno2_date     VARCHAR(10),                    -- 第2次領藥日期
  serno3_date     VARCHAR(10),                    -- 第3次領藥日期
  expire_date     VARCHAR(10) NOT NULL,           -- 過期日（計算值，第1次領藥日 + total_days - 1）
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT now(), -- 同步時間
  CONSTRAINT chk_chronic_prescriptions_date_code UNIQUE (code)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_chronic_prescriptions_date_code
  ON chronic_prescriptions_date(code);

-- 說明：
-- 1. 一個 code 只有一筆（取最近 90 天內 DATE 最大的慢連箋）
-- 2. 每筆記錄代表「目前有效的慢連箋」的領藥進度
-- 3. serno1/2/3_date 為 NULL 表示該次尚未領藥
-- 4. expire_date = 第1次領藥日 + total_days - 1 天（若未領藥則為 null）

-- ============================================
-- RPC Function：Upsert 單筆慢性病處方資料
-- sync script 會多次呼叫，每次傳一筆記錄
-- ============================================
CREATE OR REPLACE FUNCTION chronic_prescriptions_date_upsert(
  p_code        VARCHAR(10),
  p_first_date  VARCHAR(10),
  p_total_days  INTEGER,
  p_per_days   INTEGER,
  p_serno1_date VARCHAR(10),
  p_serno2_date VARCHAR(10),
  p_serno3_date VARCHAR(10),
  p_expire_date VARCHAR(10)
)
RETURNS void AS $$
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

-- 讓 anonymous 可以呼叫（建議正式環境限定 IP）
-- GRANT EXECUTE ON FUNCTION chronic_prescriptions_date_upservarchar, varchar, integer, integer, varchar, varchar, varchar, varchar) TO anon;
-- 或使用 service_key 直接呼叫，繞過 RLS