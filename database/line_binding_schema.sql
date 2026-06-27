-- ============================================
-- LINE 帳號綁定系統 — 驗證碼方案（V1 MVP，定版 v1.3）
-- 建立日期：2026-06-27
-- 更新紀錄：
--   v1.1: 補強解綁機制、key_version、CHECK約束、updated_at trigger、archive表
--   v1.2: pending_links改名為verification_codes；新增line_user_links_history；
--         修正recno_hash/user_id_hash注解，強調HMAC（非純SHA256）
-- ============================================

-- ============================================
-- 1. verification_codes（原pending_links，短效暫存表，5分鐘有效驗證碼）
-- 命名說明：此表本質是「等待病人輸入驗證碼」，非LINE官方Account Link的pending流程，
--          故正式定名為verification_codes，避免混淆。
-- ============================================
CREATE TABLE IF NOT EXISTS verification_codes (
  id              BIGSERIAL PRIMARY KEY,
  code_hash       TEXT NOT NULL,                     -- SHA256(6位驗證碼)，不存明碼
  recno_encrypted TEXT NOT NULL,                     -- AES-256-GCM 加密recno（格式：iv:encrypted:authTag）
  recno_hash      TEXT NOT NULL,                     -- HMAC-SHA256(recno, RECNO_HMAC_SECRET)，查詢索引
                                                        -- ⚠️ RECNO_HMAC_SECRET必須與AES加密金鑰分開管理。
                                                        --    病歷號僅6位數(100萬種組合)，若用純SHA256，
                                                        --    攻擊者可離線窮舉全部病歷號建立對照表；
                                                        --    HMAC的secret沒有外流就無法重建對照表。
  key_version     SMALLINT NOT NULL DEFAULT 1,        -- 加密/HMAC金鑰版本，供未來金鑰輪換使用
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,              -- created_at + 5分鐘
  attempt_count   INT NOT NULL DEFAULT 0,            -- 已錯誤次數，累計滿3次即失效
  status          TEXT NOT NULL DEFAULT 'pending',   -- pending / used / expired / failed
  used_at         TIMESTAMPTZ,                       -- 綁定成功時間（nullable）
  CONSTRAINT chk_verification_codes_status CHECK (status IN ('pending', 'used', 'expired', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_code_hash   ON verification_codes(code_hash);
CREATE INDEX IF NOT EXISTS idx_verification_codes_recno_hash  ON verification_codes(recno_hash);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at  ON verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_status      ON verification_codes(status);

CREATE INDEX IF NOT EXISTS idx_verification_codes_active_lookup
  ON verification_codes(recno_hash, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_active_code
  ON verification_codes(code_hash, status, expires_at);

-- ============================================
-- 2. verification_codes_archive（原pending_links_archive，稽核用歷史表）
-- 用途：30天前的used/expired/failed記錄先搬移至此，
--       再從verification_codes刪除，滿足稽核需求且控制主表大小
-- ============================================
CREATE TABLE IF NOT EXISTS verification_codes_archive (
  id              BIGINT PRIMARY KEY,
  code_hash       TEXT NOT NULL,
  recno_encrypted TEXT NOT NULL,
  recno_hash      TEXT NOT NULL,
  key_version     SMALLINT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  attempt_count   INT NOT NULL,
  status          TEXT NOT NULL,
  used_at         TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_archive_archived_at
  ON verification_codes_archive(archived_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_archive_recno_hash
  ON verification_codes_archive(recno_hash);

-- ============================================
-- 3. line_user_links（正式綁定表，存放「目前狀態」，方便日常查詢）
-- 重要：LINE User ID 與 RECNO 一律加密儲存，不存明文
-- 歷史紀錄：完整綁定/解綁時間軸請查 line_user_links_history（見下方第4節）
-- ============================================
CREATE TABLE IF NOT EXISTS line_user_links (
  id                 BIGSERIAL PRIMARY KEY,
  encrypted_line_id  TEXT NOT NULL,                  -- AES-256-GCM 加密LINE userId
  encrypted_recno    TEXT NOT NULL,                  -- AES-256-GCM 加密recno
  user_id_hash       TEXT NOT NULL,                  -- HMAC-SHA256(line_user_id, USER_ID_HMAC_SECRET)，查詢索引
                                                       -- ⚠️ 統一使用HMAC而非純SHA256，理由與recno_hash相同：
                                                       --    避免離線窮舉攻擊建立對照表，secret需與AES金鑰分開管理。
  recno_hash         TEXT NOT NULL,                  -- HMAC-SHA256(recno, RECNO_HMAC_SECRET)，查詢索引
  key_version        SMALLINT NOT NULL DEFAULT 1,   -- 加密/HMAC金鑰版本，供未來金鑰輪換使用
  status             TEXT NOT NULL DEFAULT 'active', -- active / unbound
  linked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  unbound_at         TIMESTAMPTZ,                    -- 解綁時間（nullable）
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_user_links_status CHECK (status IN ('active', 'unbound'))
);

CREATE INDEX IF NOT EXISTS idx_line_user_links_user_id_hash ON line_user_links(user_id_hash);
CREATE INDEX IF NOT EXISTS idx_line_user_links_recno_hash   ON line_user_links(recno_hash);

-- 只限制「目前生效中」的綁定不可重複，解綁後可重新綁定
CREATE UNIQUE INDEX IF NOT EXISTS idx_line_user_links_active_unique
  ON line_user_links(user_id_hash, recno_hash)
  WHERE status = 'active';

-- ============================================
-- 4. line_user_links_history（綁定/解綁完整時間軸，供稽核查詢）
-- 設計理由：line_user_links本身用UPDATE維護「目前狀態」以利日常查詢效能，
--          但每次狀態變化（綁定/解綁）都同步寫一筆到這裡，
--          確保「同一人對同一病歷號綁了又解、解了又綁」的完整歷程可追溯。
-- ============================================
CREATE TABLE IF NOT EXISTS line_user_links_history (
  id              BIGSERIAL PRIMARY KEY,
  link_id         BIGINT NOT NULL,                    -- 對應line_user_links.id
  user_id_hash    TEXT NOT NULL,
  recno_hash      TEXT NOT NULL,
  action          TEXT NOT NULL,                      -- bind / unbind
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_line_user_links_history_action CHECK (action IN ('bind', 'unbind'))
);

CREATE INDEX IF NOT EXISTS idx_line_user_links_history_link_id         ON line_user_links_history(link_id);
CREATE INDEX IF NOT EXISTS idx_line_user_links_history_recno_hash    ON line_user_links_history(recno_hash);
CREATE INDEX IF NOT EXISTS idx_line_user_links_history_user_id_hash   ON line_user_links_history(user_id_hash);

-- ============================================
-- 5. updated_at 自動更新 trigger
-- ============================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_line_user_links_updated_at ON line_user_links;
CREATE TRIGGER trg_line_user_links_updated_at
  BEFORE UPDATE ON line_user_links
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================
-- 設計說明
-- ============================================
-- 一對多：一個LINE userId可對應多筆不同recno_hash → 允許一人綁多個病歷號
-- 多對一：一個recno_hash可被多筆不同user_id_hash對應 → 允許同病歷號被多個LINE帳號綁定（家屬代綁等情境）
-- 兩者皆不設外鍵或額外限制，僅靠(user_id_hash, recno_hash, status='active')組合的
-- partial unique index避免「重複的生效中綁定」，解綁後的歷史記錄保留在line_user_links_history。
-- ============================================
-- 查詢範例（程式邏輯參考，非SQL執行內容）
-- ============================================

-- 重複綁定檢查（產生驗證碼前）：
-- SELECT * FROM line_user_links WHERE recno_hash = $1 AND status = 'active';

-- 檢查是否有生效中驗證碼：
-- SELECT * FROM verification_codes
-- WHERE recno_hash = $1 AND status = 'pending' AND expires_at > now();

-- 驗證碼碰撞檢查：
-- SELECT 1 FROM verification_codes
-- WHERE code_hash = $1 AND status = 'pending' AND expires_at > now();

-- 驗證碼比對：
-- SELECT * FROM verification_codes
-- WHERE code_hash = $1 AND status = 'pending' AND expires_at > now();

-- 錯誤次數遞增（原子操作）：
-- UPDATE verification_codes SET attempt_count = attempt_count + 1 WHERE id = $1 RETURNING attempt_count;

-- 綁定成功（transaction）：
-- BEGIN;
-- INSERT INTO line_user_links (encrypted_line_id, encrypted_recno, user_id_hash, recno_hash, key_version)
-- VALUES ($1, $2, $3, $4, $5) RETURNING id;
-- INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
-- VALUES ($6, $3, $4, 'bind');
-- COMMIT;

-- 解綁操作（transaction）：
-- BEGIN;
-- UPDATE line_user_links SET status = 'unbound', unbound_at = now()
-- WHERE user_id_hash = $1 AND recno_hash = $2 AND status = 'active' RETURNING id;
-- INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
-- VALUES ($3, $1, $2, 'unbind');
-- COMMIT;

-- 查詢某病歷號完整綁定歷史（稽核用）：
-- SELECT * FROM line_user_links_history WHERE recno_hash = $1 ORDER BY occurred_at;

-- 過期驗證碼清理（排程Job A，每5分鐘）：
-- UPDATE verification_codes SET status = 'expired'
-- WHERE status = 'pending' AND expires_at <= now();

-- 舊資料歸檔+清理（排程Job B，每天）：
-- INSERT INTO verification_codes_archive (...) SELECT ... FROM verification_codes
-- WHERE status IN ('used', 'expired', 'failed') AND created_at < now() - INTERVAL '30 days'
-- ON CONFLICT (id) DO NOTHING;
-- DELETE FROM verification_codes WHERE status IN ('used', 'expired', 'failed')
-- AND created_at < now() - INTERVAL '30 days';