-- 藥局資料表
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    hours TEXT,
    closed_days TEXT,
    services TEXT[],
    insurance BOOLEAN DEFAULT true,
    notes TEXT,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 診所資料表
CREATE TABLE IF NOT EXISTS clinics (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    address TEXT NOT NULL,
    phone TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    hours TEXT,
    closed_days TEXT,
    doctors TEXT[],
    specialties TEXT[],
    insurance BOOLEAN DEFAULT true,
    notes TEXT,
    source_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引加速搜尋
CREATE INDEX idx_pharmacies_name ON pharmacies(name);
CREATE INDEX idx_pharmacies_address ON pharmacies(address);
CREATE INDEX idx_clinics_name ON clinics(name);
CREATE INDEX idx_clinics_department ON clinics(department);
CREATE INDEX idx_clinics_address ON clinics(address);

-- 插入範例資料
INSERT INTO pharmacies (name, address, phone, hours, closed_days, notes) VALUES
('宏益藥局', '嘉義縣水上鄉正義路 51 號', '0928-532519', '週日 08:00-12:00, 15:00-18:00, 18:30-20:30', '需預約', '陳小姐');

INSERT INTO clinics (name, department, address, phone, hours, notes) VALUES
('賜安診所', '不分科', '嘉義縣水上鄉正義路 53 號', '05-2600934', '週一至週五 15:00-18:00', '門診診療');