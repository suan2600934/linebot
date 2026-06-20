-- 診所基本資訊
CREATE TABLE IF NOT EXISTS clinics (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  hours_morning TEXT,
  hours_afternoon TEXT,
  hours_evening TEXT,
  services TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- 醫師資料
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT,
  specialties TEXT[],
  education TEXT,
  experience TEXT,
  color TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 門診班表
CREATE TABLE IF NOT EXISTS schedule (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER REFERENCES doctors(id),
  date DATE NOT NULL,
  period TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 服務項目
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 附近藥局
CREATE TABLE IF NOT EXISTS pharmacies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  hours TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read clinics" ON clinics FOR SELECT USING (true);
CREATE POLICY "Public read doctors" ON doctors FOR SELECT USING (true);
CREATE POLICY "Public read schedule" ON schedule FOR SELECT USING (true);
CREATE POLICY "Public read services" ON services FOR SELECT USING (true);
CREATE POLICY "Public read pharmacies" ON pharmacies FOR SELECT USING (true);

-- 插入診所資料
INSERT INTO clinics (name, phone, address, hours_morning, hours_afternoon, hours_evening, services) VALUES
('賜安診所', '(05) 260-0934', '嘉義縣水上鄉正義路 53 號', '08:00-12:00', '15:00-18:00', '18:30-20:30', ARRAY['一般內科', '小兒科', '耳鼻喉科', '皮膚科', '成人健檢', '兒童健檢', '疫苗注射']);

-- 插入醫師資料
INSERT INTO doctors (name, title, specialties, education, experience, color) VALUES
('周見成', '院長', ARRAY['小兒科', '兒童腸胃', '兒童營養', '耳鼻喉科'], '長庚大學醫學系畢業', '高雄長庚醫院兒童內科部住院醫師', '#3498DB'),
('鄭名傑', '醫師', ARRAY['一般內科', '小兒科', '耳鼻喉科', '皮膚問題'], '', '嘉義基督教醫院內科醫師', '#E74C3C'),
('石逸仁', '醫師', ARRAY['一般內科', '小兒科', '耳鼻喉科', '皮膚問題'], '', '奇美醫院內科醫師', '#27AE60');

-- 插入服務項目
INSERT INTO services (name, category, description) VALUES
('成人健康檢查', '預防保健', '40歲以上免費成人健康檢查'),
('B型肝炎篩檢', '預防保健', '免費B型肝炎篩檢'),
('C型肝炎篩檢', '預防保健', '免費C型肝炎篩檢'),
('兒童預防保健', '兒童健康', '兒童生長發育評估'),
('兒童疫苗注射', '疫苗', 'B型肝炎、五合一、肺炎鏈球菌等'),
('流感疫苗', '疫苗', '每年流感疫苗注射'),
('門診抽血檢查', '檢驗', '血糖、血脂肪、腎功能檢查');

-- 插入藥局資料
INSERT INTO pharmacies (name, phone, address, hours) VALUES
('宏益藥局', '05260-1714', '嘉義縣水上鄉正義路 51 號', '08:00-12:00 / 15:00-18:00 / 18:30-20:30');