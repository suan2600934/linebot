-- schedules 表唯一性約束
--
-- 背景：sync-schedule.js 曾把 knowledge-base.md 中「所有月份」的週別
--       一併寫入當月份，導致同一個 (year, month, week_number) 有兩筆資料。
--       getThisWeekSchedule() 使用 .single() 查詢，遇到兩筆會直接拋錯，
--       LINE Bot 便顯示「目前無法取得班表資訊」。
--
-- 加上此約束後，資料庫層級會直接拒絕重複寫入，讓問題立即浮現而非靜默產生髒資料。
--
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上並執行（可重複執行）

-- 1. 先清除既有重複紀錄（每個 year/month/week_number 只保留 id 最小的一筆）
DELETE FROM schedules
WHERE id NOT IN (
    SELECT MIN(id)
    FROM schedules
    GROUP BY year, month, week_number
);

-- 2. 建立唯一約束
ALTER TABLE schedules
    ADD CONSTRAINT schedules_year_month_week_unique
    UNIQUE (year, month, week_number);

-- 3. 驗證（應回傳 0 筆）
SELECT year, month, week_number, COUNT(*) AS cnt
FROM schedules
GROUP BY year, month, week_number
HAVING COUNT(*) > 1;
