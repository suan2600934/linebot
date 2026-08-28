const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: 'H:/opencode/linebot/.env' });

const PGPATH = process.env.PGPATH || 'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe';
const BACKUP_DIR = 'H:/supabase/backup';
const LOG_FILE = path.join(BACKUP_DIR, 'backup.log');
const POOL_HOST = 'aws-1-ap-southeast-1.pooler.supabase.com';
const POOL_PORT = '5432';
const PROJECT_REF = 'kbpyxboleoefwvdnjcod';
const DB_USER = `postgres.${PROJECT_REF}`;
const DB_PASSWORD = encodeURIComponent(process.env.PGPASSWORD);
const DB_NAME = 'postgres';
const RETENTION_DAYS = 30;

function log(msg) {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const line = `${now} ${msg}`;
    console.log(line);
    fs.appendFileSync(LOG_FILE, line + '\n');
}

function cleanup() {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('supabase_backup_') && f.endsWith('.dump'));
    const now = Date.now();
    const cutoff = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const file of files) {
        const full = path.join(BACKUP_DIR, file);
        if (now - fs.statSync(full).mtimeMs > cutoff) {
            fs.unlinkSync(full);
            log(`[CLEANUP] 刪除舊備份：${file}`);
            count++;
        }
    }
    if (count) log(`[CLEANUP] 共刪除 ${count} 個舊備份`);
}

function run() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const filename = `supabase_backup_${timestamp}.dump`;
    const filepath = path.join(BACKUP_DIR, filename);
    const connStr = `postgresql://${DB_USER}:${DB_PASSWORD}@${POOL_HOST}:${POOL_PORT}/${DB_NAME}?sslmode=require`;

    log(`[START] 開始備份`);
    log(`[INFO] 目標：${filepath}`);

    try {
        execSync(`"${PGPATH}" -Fc -f "${filepath}" "${connStr}"`, { stdio: 'inherit' });
    } catch (err) {
        log(`[ERROR] pg_dump 失敗：${err.message}`);
        process.exit(1);
    }

    const stats = fs.statSync(filepath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    log(`[INFO] 檔案大小：${sizeMB} MB`);

    if (stats.size < 100) {
        log(`[ERROR] 備份檔案過小，疑似失敗`);
        process.exit(1);
    }

    cleanup();

    log(`[SUCCESS] 備份完成：${filename}（${sizeMB} MB）`);
}

run();