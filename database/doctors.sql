-- 醫師資料表
CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT,
    clinic_id INTEGER REFERENCES clinics(id),
    specialties TEXT[],
    education TEXT,
    experience TEXT,
    photo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 班表資料表
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    clinic_id INTEGER REFERENCES clinics(id),
    date DATE NOT NULL,
    shift_type TEXT NOT NULL, -- morning, afternoon, evening
    start_time TIME,
    end_time,
    is_on_duty BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX idx_doctors_name ON doctors(name);
CREATE INDEX idx_doctors_clinic ON doctors(clinic_id);
CREATE INDEX idx_schedules_doctor ON schedules(doctor_id);
CREATE INDEX idx_schedules_clinic ON schedules(clinic_id);
CREATE INDEX idx_schedules_date ON schedules(date);

-- 插入賜安診所醫師資料
INSERT INTO doctors (name, title, clinic_id, specialties, education, experience) VALUES
('周見成', '院長', 1, 
 ARRAY['小兒科', '家醫科', '內科'], 
 '中國醫藥學院醫學系', 
 '前嘉義基督教醫院小兒科主治醫師'),
('鄭名傑', '醫師', 1, 
 ARRAY['小兒科', '耳鼻喉科'], 
 '高雄醫學大學醫學系', 
 '前長庚醫院小兒科主治醫師'),
('石逸仁', '醫師', 1, 
 ARRAY['內科', '家醫科'], 
 '中山醫學大學醫學系', 
 '前榮民總醫院內科主治醫師');

-- 插入賜安診所詳細資料（更新）
UPDATE clinics SET 
    department = '小兒科、耳鼻喉科、內科、家醫科',
    hours = '早診 8:00-12:00, 午診 15:00-18:00, 晚診 18:30-20:30',
    closed_days = '週日（每月第一個週日不門診）',
    doctors = ARRAY['周見成', '鄭名傑', '石逸仁'],
    specialties = ARRAY['小兒科', '耳鼻喉科', '內科', '家醫科'],
    notes = '主治項目：小兒科、耳鼻喉科、內科、家醫科、過敏氣喘、糖尿病、高血壓'
WHERE name = '賜安診所';