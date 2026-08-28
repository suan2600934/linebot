-- ============================================
-- Supabase Row-Level Security (RLS) 啟用腳本
-- 建立日期：2026-08-12
-- 用途：修補 Supabase 安全警報 — 所有 Table 啟用 RLS
-- 適用專案：suanclinic (kbpyxboleoefwvdnjcod)
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上執行
--          或 psql / pg_dump 連線執行
-- ============================================
--
-- 安全設計原則
-- ------------------------------
-- service_role (後端 LINE Bot / sync script)
--   → 在 Supabase 中 bypass RLS，無需額外 policy
--   → 所有寫入、敏感查詢統一走 service_role
--
-- anon / public (前端直接呼叫 Supabase 時)
--   → 僅允許必要的讀取（如 queue_status 寫入、公開資訊讀取）
--   → 醫療敏感資料一律不开放
--
-- ============================================
-- 1. 公開資訊表（診所、醫師、藥局、服務、班表）
-- ============================================

-- clinics（診所基本資料）
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinics_select_anon" ON clinics
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "clinics_all_service_role" ON clinics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- doctors（醫師資料）
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors_select_anon" ON doctors
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "doctors_all_service_role" ON doctors
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- schedules / schedule（班表；schedule 為舊版表名，可能不存在）
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select_anon" ON schedules
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "schedules_all_service_role" ON schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_select_anon" ON schedule
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "schedule_all_service_role" ON schedule
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- services（服務項目：預防保健/兒童疫苗）
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_select_anon" ON services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "services_all_service_role" ON services
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- pharmacies（藥局資料）
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharmacies_select_anon" ON pharmacies
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pharmacies_all_service_role" ON pharmacies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 2. 醫療敏感資訊表（含個資）- 僅開放給 service_role
-- ============================================

-- queue_status（即時看診進度 — 需開放 anon 寫入供 Python 上傳腳本）
ALTER TABLE queue_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_status_select_anon" ON queue_status
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "queue_status_insert_anon" ON queue_status
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "queue_status_all_service_role" ON queue_status
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- knowledge_base（AI 知識庫 — LINE Bot 讀取用）
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "knowledge_base_select_service_role" ON knowledge_base
  FOR SELECT TO service_role USING (true);
CREATE POLICY "knowledge_base_all_service_role" ON knowledge_base
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- chronic_prescriptions_date（慢性病領藥記錄 — 含病歷號，極敏感）
ALTER TABLE chronic_prescriptions_date ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chronic_prescriptions_date_select_service_role" ON chronic_prescriptions_date
  FOR SELECT TO service_role USING (true);
CREATE POLICY "chronic_prescriptions_date_all_service_role" ON chronic_prescriptions_date
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 3. LINE 綁定系統（極敏感 — 加密個資 + HMAC 索引）
-- ============================================

-- verification_codes（5 分鐘效期驗證碼，含 HMAC 雜湊）
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification_codes_all_service_role" ON verification_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- verification_codes_archive（過期歸檔）
ALTER TABLE verification_codes_archive ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verification_codes_archive_all_service_role" ON verification_codes_archive
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- line_user_links（LINE userId ↔ 病歷號綁定表）
ALTER TABLE line_user_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "line_user_links_all_service_role" ON line_user_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- line_user_links_history（綁定/解綁歷史紀錄）
ALTER TABLE line_user_links_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "line_user_links_history_all_service_role" ON line_user_links_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- 4. 安全確認查詢
-- ============================================
--
-- 執行後可透過以下查詢確認所有 Table 的 RLS 狀態：
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- 預期結果：所有 tablename 的 rowsecurity = true
--
-- 查詢目前所有 policy：
--
-- SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- ============================================
