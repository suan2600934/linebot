# LINE 帳號綁定系統 — 實作紀錄

## 📅 最後更新：2026-06-28（v1.5）

---

## 🚨 Zeabur 部署踩雷紀錄（2026-06-28）

### 雷點一：DATABASE_URL 環境變數未設定 → Missing DATABASE_URL
**症狀**：`[initPool] failed: Error: Missing DATABASE_URL` → 容器不斷重啟，BackOff
**原因**：Zeabur 環境變數裡沒有設定 DATABASE_URL
**解法**：在 Zeabur 環境變數新增（值從 Supabase Dashboard → Connection Pooling 取得）：
```
DATABASE_URL=postgresql://postgres.kbpyxboleoefwvdnjcod:awSDlKU0zaobAa7D@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 雷點二：new URL() 解析 DATABASE_URL → TypeError: Invalid URL
**症狀**：`TypeError: Invalid URL` 在 `initPool` 階段
**原因**：`new URL()` 遇到密碼含特殊字元（當時密碼有 `@`）或 URL 格式不符預期時直接拋錯
**解法**：改用 regex 直接解析 connection string，不依賴 URL 物件：
```js
const re = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^?]+)$/;
const match = connStr.match(re);
// 同時支援 postgres:// 和 postgresql://，database 只取 ? 之前的部分
```

### 雷點三：IPv6 ENETUNREACH → Supabase DNS 返回 IPv6 但容器不支援
**症狀**：`connect ENETUNREACH 2406:da18:...:5432`（IPv6 address）
**原因**：Zeabur 容器網路不支援 IPv6 出去，Supabase DNS 返回 AAAA 記錄，pg 拿到 IPv6 address
**解法**：
1. 使用 Supabase **Connection Pooler**（port 6543），由 Pooler 處理對外的連線
2. Pooler 的 host 是 `aws-1-ap-southeast-1.pooler.supabase.com`，不會返回 IPv6
3. 如果必須直接連 5432：在 code 裡做 DNS resolve4 並 fallback 到硬編碼 IPv4

### 雷點四：兩個 Node.js service 綁同一 port → 只有一個能搶到
**症狀**：`/health` 和 `/api/*` 都 404，請求被主要 LINE Bot 截走
**原因**：主要 Bot (index.js) 和 lineid_code 同時部署但綁相同 port，先啟動的搶贏
**解法**：將 lineid_code 改成不同 port（如 8081），在 zeabur.json 和 code 裡同步修改：
```js
const PORT = parseInt(process.env.PORT || '8081', 10);
```

---

## 正確的 Zeabur 部署檢查清單

1. **確認有設定 `DATABASE_URL`**，值為 Pooler URL（port 6543），格式：
   ```
   postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres
   ```
2. **確認環境變數有設定這些必要值**：
   - `APP_KEY_V1`
   - `APP_KEY_CURRENT_VERSION`
   - `CLEANUP_API_KEY`
   - `VERIFY_CODE_TTL_MINUTES`
   - `VERIFY_MAX_ATTEMPTS`
   - `DATABASE_URL`
3. **確認程式裡預設的 PORT 與 Zeabur 設定一致**，避免被平台覆蓋
4. **使用 Connection Pooler**（port 6543）而非直接 5432，適合 Serverless/容器環境

---

## 系統架構

### 驗證碼方案流程
```
櫃台查詢病人（patdb.dbf）
    ↓
病人確認身份（雙證件 + 人工確認）
    ↓
櫃台產生驗證碼 → POST /api/create-verify-code { recno }
    ↓
病人拿驗證碼到 LINE 對話框輸入
    ↓
LINE 發送 verify code → POST /api/verify
    ↓
系統綁定 userId + recno → 寫入 line_user_links + line_user_links_history
```

---

## 資料庫 Schema（v1.3）

### verification_codes（原 pending_links，5分鐘有效驗證碼）
| 欄位 | 說明 |
|------|------|
| id | PK |
| code_hash | HMAC-SHA256(6位驗證碼, APP_KEY)，不存明碼（防止彩虹表攻擊） |
| recno_encrypted | AES-256-GCM 加密 recno（格式：iv:encrypted:authTag） |
| recno_hash | HMAC-SHA256(recno, RECNO_HMAC_SECRET)，查詢索引 |
| key_version | 加密/HMAC 金鑰版本（預設 1） |
| created_at | 產生時間 |
| expires_at | 過期時間（created_at + 5分鐘） |
| attempt_count | 錯誤次數（累計滿3次失效） |
| status | pending / used / expired / failed |
| used_at | 綁定成功時間 |

### line_user_links（正式綁定表，存放目前狀態）
| 欄位 | 說明 |
|------|------|
| id | PK |
| encrypted_line_id | AES-256-GCM 加密 LINE userId |
| encrypted_recno | AES-256-GCM 加密 recno |
| user_id_hash | HMAC-SHA256(line_user_id, USER_ID_HMAC_SECRET)，查詢索引 |
| recno_hash | HMAC-SHA256(recno, RECNO_HMAC_SECRET)，查詢索引 |
| key_version | 加密/HMAC 金鑰版本（預設 1） |
| status | active / unbound |
| linked_at | 綁定時間 |
| unbound_at | 解綁時間 |
| updated_at | 更新時間（自動更新 trigger） |

### line_user_links_history（綁定/解綁完整時間軸）
| 欄位 | 說明 |
|------|------|
| id | PK |
| link_id | 對應 line_user_links.id |
| user_id_hash | HMAC-SHA256(line_user_id, USER_ID_HMAC_SECRET) |
| recno_hash | HMAC-SHA256(recno, RECNO_HMAC_SECRET) |
| action | bind / unbind |
| occurred_at | 發生時間 |

### verification_codes_archive（稽核用歷史表）
30天前的 used/expired/failed 記錄搬移至此。

---

## 加密設計

| 用途 | 方法 |
|------|------|
| 驗證碼儲存 | HMAC-SHA256(驗證碼, APP_KEY) → code_hash |
| recno 索引 | HMAC-SHA256(recno, RECNO_HMAC_SECRET) → recno_hash |
| recno 加密 | AES-256-GCM → recno_encrypted |
| LINE userId 索引 | HMAC-SHA256(userId, USER_ID_HMAC_SECRET) → user_id_hash |
| LINE userId 加密 | AES-256-GCM → encrypted_line_id |

**為什麼不用純 SHA256？**
- 驗證碼僅 6 位數（百萬種組合），攻擊者可離線窮舉全部組合建立對照表
- 病歷號也只有 6 位數，同樣脆弱
- HMAC 需要 secret key，沒有外流就無法重建對照表
- **所有 *_hash 欄位統一使用 HMAC-SHA256**，金鑰需分開管理（不同於 AES 金鑰）

**格式**：`iv:encrypted:authTag`（Base16 hex）

---

## 環境變數（需設定）

```env
# AES-256-GCM + HMAC-SHA256 共用金鑰（32 bytes, base64 編碼）
# 金鑰輪替：新增 APP_KEY_V2 並改 APP_KEY_CURRENT_VERSION=2
APP_KEY_V1=xxx                    # 第一版金鑰
APP_KEY_V2=xxx                     # （選填）第二版金鑰，用於金鑰輪替
APP_KEY_CURRENT_VERSION=1          # 新資料使用的金鑰版本

# 金鑰版本（與 APP_KEY_CURRENT_VERSION 同步）
KEY_VERSION=1
```

---

## API 規格

### POST /api/create-verify-code
**用途**：櫃台產生驗證碼

**Request Body**：
```json
{ "recno": "003245" }
```

**Response**：
```json
{
  "success": true,
  "verify_code": "123456",
  "expires_in": 300
}
```

**邏輯**：
1. 計算 recno_hash = HMAC-SHA256(recno, RECNO_HMAC_SECRET)
2. 檢查 line_user_links 是否已有 active 綁定
3. 檢查 verification_codes 是否有同 recno_hash 的生效中驗證碼
4. 若有，標記舊碼為 expired
5. 產生 6 位數驗證碼，檢查 code_hash 不碰撞
6. 加密 recno，計算 recno_hash
7. 寫入 verification_codes

### POST /api/verify
**用途**：LINE 收到驗證碼後觸發

**Request Body**：
```json
{
  "replyToken": "xxx",
  "userId": "Uxxxxxx",
  "code": "123456"
}
```

**Response**：
```json
{
  "success": true,
  "message": "綁定成功"
}
```

**邏輯**：
1. 查 verification_codes：code_hash = HMAC-SHA256(code, APP_KEY) AND status = 'pending' AND expires_at > now()
2. 若找不到，回傳失敗
3. 原子遞增 attempt_count，RETURNING attempt_count
4. 若 attempt_count >= 3，標記為 failed，回傳失敗
5. 加密 LINE userId，計算 user_id_hash
6. Transaction：
   - INSERT INTO line_user_links
   - INSERT INTO line_user_links_history (action = 'bind')
7. 更新 verification_codes 為 used

### POST /api/cleanup
**用途**：排程清理過期驗證碼

**邏輯**：
```sql
UPDATE verification_codes SET status = 'expired'
WHERE status = 'pending' AND expires_at <= now();
```

---

## 待辦事項

### MVP（現在要做）
- [x] 建立 Supabase 表格（v1.3）
- [x] 建立 LINE_BINDING_IMPL.md 實作紀錄
- [x] crypto-utils.js：HMAC-SHA256 / AES-256-GCM / SHA256 加密工具（含單元測試 36/36 通過）
- [x] index.js：三支 API（POST /api/create-verify-code、/api/verify、/api/cleanup）已完成
- [ ] Python 腳本：讀取 patdb.dbf 並呼叫 Zeabur API
- [ ] Python 腳本：讀取 patdb.dbf 並呼叫 Zeabur API
- [ ] 測試並 merge 回 master

### 正式版（之後再做）
- [ ] 排程 Job A：每 5 分鐘標記過期驗證碼
- [ ] 排程 Job B：每天搬移舊記錄到 archive
- [ ] 更新綁定（Upsert）
- [ ] 取消綁定（UX 待定）

---

## 設計原則

1. **驗證碼明碼不落地**：只在記憶體中用來顯示/列印，比對時用 hash
2. **HMAC secret 與 AES key 分開**：不同金鑰、不同用途
3. **HMAC 取代純 SHA256**：防止離線窮舉攻擊
4. **唯一約束在 hash 欄位**：因為 AES-GCM 每次用隨機 IV
5. **部分唯一索引**：只限制 active 狀態，解綁後可重新綁定
6. **attempt_count 原子操作**：避免 race condition
7. **line_user_links 用 UPDATE**：只存放目前狀態，方便日常查詢
8. **line_user_links_history 用 INSERT**：每次狀態變化都記錄，支援稽核

---

## 查詢範例

```sql
-- 重複綁定檢查（產生驗證碼前）
SELECT * FROM line_user_links WHERE recno_hash = $1 AND status = 'active';

-- 檢查是否有生效中驗證碼
SELECT * FROM verification_codes
WHERE recno_hash = $1 AND status = 'pending' AND expires_at > now();

-- 驗證碼比對
SELECT * FROM verification_codes
WHERE code_hash = HMAC-SHA256($1, APP_KEY) AND status = 'pending' AND expires_at > now();

-- 解綁（transaction）
BEGIN;
UPDATE line_user_links SET status = 'unbound', unbound_at = now()
WHERE user_id_hash = $1 AND recno_hash = $2 AND status = 'active' RETURNING id;
INSERT INTO line_user_links_history (link_id, user_id_hash, recno_hash, action)
VALUES ($3, $1, $2, 'unbind');
COMMIT;

-- 過期清理
UPDATE verification_codes SET status = 'expired'
WHERE status = 'pending' AND expires_at <= now();

-- 查詢某病歷號完整歷史（稽核）
SELECT * FROM line_user_links_history WHERE recno_hash = $1 ORDER BY occurred_at;
```