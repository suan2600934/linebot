# LINE 帳號綁定系統 — 實作紀錄

## 📅 最後更新：2026-06-29（v1.9）

---

## 🚨 Zeabur 部署踩雷紀錄（2026-06-28）

### 雷點一：DATABASE_URL 環境變數未設定 → Missing DATABASE_URL
**症狀**：`[initPool] failed: Error: Missing DATABASE_URL` → 容器不斷重啟，BackOff
**原因**：Zeabur 環境變數裡沒有設定 DATABASE_URL
**解法**：在 Zeabur 環境變數新增。Pooler URL 取得方式：Supabase Dashboard → 你的專案 → **連線（Connection）** → 上方點選 **CONNECT** → 選 **DIRECT** → 下方即為 Pooler URL（port 6543）。格式：
```
DATABASE_URL=postgresql://postgres.kbpyxboleoefwvdnjcod:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres
```

### 雷點二：new URL() 解析 DATABASE_URL → TypeError: Invalid URL
**症狀**：`TypeError: Invalid URL` 在 `initPool` 階段
**原因**：`new URL()` 遇到密碼含特殊字元（當時密碼有 `@`）或 URL 格式不符預期時直接拋錯
**解法**：改用 regex 直接解析 connection string，不依賴 URL 物件：
```js
const re = /^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/([^?]+)$/;
const match = connStr.match(re);
```
同時支援 `postgres://` 和 `postgresql://`，database 只取 `?` 之前的部分。

### 雷點三：IPv6 ENETUNREACH → Supabase DNS 返回 IPv6 但容器不支援
**症狀**：`connect ENETUNREACH 2406:da18:...:5432`（IPv6 address）
**原因**：Zeabur 容器網路不支援 IPv6 出去，Supabase DNS 返回 AAAA 記錄，pg 拿到 IPv6 address
**解法**：使用 Supabase **Connection Pooler**（port 6543），由 Pooler 處理對外的連線，不會返回 IPv6。

### 雷點四：兩個 Node.js service 綁同一 port → 只有一個能搶到
**症狀**：`/health` 和 `/api/*` 都 404，請求被主要 LINE Bot 截走
**原因**：主要 Bot (index.js) 和 lineid_code 同時部署但綁相同 port，先啟動的搶贏
**解法**：將 lineid_code 改成不同 port（如 8081）。

### 雷點五：全域 express.json() 破壞 LINE webhook signature 驗證
**症狀**：`SignatureValidationFailed`，LINE Console 顯示 500 Internal Server Error
**原因**：`app.use(express.json())` 在所有 route 之前先把 body 解析成 JSON，LINE middleware 因此拿不到原始 body 驗 signature
**解法**：移除全域 middleware，個別 API route 加上 `express.json()`：
```js
app.post('/api/create-verify-code', express.json(), async (req, res) => {...});
app.post('/api/verify', express.json(), async (req, res) => {...});
app.post('/api/cleanup', express.json(), async (req, res) => {...});
// LINE webhook 不用 express.json()，middleware 自己處理 raw body
```

### 雷點六：LINE Webhook 需要 raw body 做 signature 驗證
**症狀**：`SignatureValidationFailed` 500 錯誤
**原因**：LINE middleware 需要原始 request body 做 HMAC 驗證，不能被任何 middleware 先吃掉
**解法**：LINE Webhook route 的 middleware 順序：
```js
app.post('/api/line-webhook',
  middleware({ channelSecret: process.env.LINE_CHANNEL_SECRET }),
  async (req, res) => {...}
);
```
LINE middleware 必須放第一順位，且不能有任何 `express.raw()` 或 `express.json()` 在它之前。

---

## 正確的 Zeabur 部署檢查清單

1. **確認有設定 `DATABASE_URL`**，值為 Pooler URL（port 6543），格式：
   ```
   postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres
   ```
2. **LINE Messaging API 環境變數**（LINE Webhook 用）：
   - `LINE_CHANNEL_SECRET` — LINE Developers Console 取得
   - `LINE_CHANNEL_ACCESS_TOKEN` — LINE Developers Console 取得
   - `API_BASE_URL` — 供 line-webhook 內部呼叫 `/api/verify`
3. **加密相關環境變數**：
   - `APP_KEY_V1`
   - `APP_KEY_CURRENT_VERSION`
   - `CLEANUP_API_KEY`
4. **驗證碼設定**：
   - `VERIFY_CODE_TTL_MINUTES`（預設 5）
   - `VERIFY_MAX_ATTEMPTS`（預設 3）
5. **使用 Connection Pooler**（port 6543）而非直接 5432，適合 Serverless/容器環境
6. **LINE Developers Console Webhook URL** 設為：
   ```
   https://lineid-code.zeabur.app/api/line-webhook
   ```
   並確認「使用 Webhook」開啟、「自動回應」關閉。

---

## 系統架構

### 驗證碼方案流程（完整）
```
櫃台（patdb.dbf 查詢病人）
    ↓
櫃台產生驗證碼 → POST /api/create-verify-code { recno }
    ↓
病人拿驗證碼到手機，搜尋「賜安診所」LINE 官方帳號，輸入驗證碼
    ↓
LINE Platform 收到訊息 → POST /api/line-webhook
    ↓
LINE Webhook 驗 signature → 確認是 LINE 平台的合法請求
    ↓
檢查是否為 6 位數 → 是 → 呼叫 /api/verify { code, lineUserId }
    ↓
/api/verify 內部用 code 反查 recno，atomic 寫入 line_user_links
    ↓
LINE Bot 回覆「✅ 綁定成功！」給病人
```

---

## 資料庫 Schema（v1.6）

### verification_codes
| 欄位 | 說明 |
|------|------|
| id | PK |
| code_hash | HMAC-SHA256(6位驗證碼, APP_KEY)，不存明碼 |
| recno_encrypted | AES-256-GCM 加密 recno |
| recno_hash | HMAC-SHA256(recno)，查詢索引 |
| key_version | 金鑰版本（預設 1） |
| created_at | 產生時間 |
| expires_at | 過期時間（created_at + 5分鐘） |
| attempt_count | 錯誤次數（廢棄，保留欄位） |
| status | pending / used / expired / failed |
| used_at | 綁定成功時間 |

### line_user_links
| 欄位 | 說明 |
|------|------|
| id | PK |
| encrypted_line_id | AES-256-GCM 加密 LINE userId |
| encrypted_recno | AES-256-GCM 加密 recno |
| user_id_hash | HMAC-SHA256(lineUserId)，查詢索引 |
| recno_hash | HMAC-SHA256(recno)，查詢索引 |
| key_version | 金鑰版本（預設 1） |
| status | active / unbound |
| linked_at | 綁定時間 |
| unbound_at | 解綁時間 |

### line_user_links_history
| 欄位 | 說明 |
|------|------|
| id | PK |
| link_id | 對應 line_user_links.id |
| user_id_hash | HMAC-SHA256(lineUserId) |
| recno_hash | HMAC-SHA256(recno) |
| action | bind / unbind |
| occurred_at | 發生時間 |

### verification_codes_archive
30天前的 used/expired/failed 記錄搬移至此（供稽核）。

---

## 加密設計

| 用途 | 方法 |
|------|------|
| 驗證碼儲存 | HMAC-SHA256(驗證碼, APP_KEY) → code_hash |
| recno 索引 | HMAC-SHA256(recno) → recno_hash |
| recno 加密 | AES-256-GCM → recno_encrypted |
| LINE userId 索引 | HMAC-SHA256(userId) → user_id_hash |
| LINE userId 加密 | AES-256-GCM → encrypted_line_id |

**為什麼不用純 SHA256？**
- 驗證碼僅 6 位數（百萬種組合），攻擊者可離線窮舉全部組合建立對照表
- HMAC 需要 secret key，沒有外流就無法重建對照表
- **所有 `*_hash` 欄位統一使用 HMAC-SHA256**

**格式**：`iv:authTag:ciphertext`（base64）

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
  "ok": true,
  "data": {
    "id": "1",
    "code": "123456",
    "expiresAt": "2026-06-28T06:00:00.000Z"
  }
}
```

**邏輯**：
1. 同一 recno 有 pending 驗證碼 → 先標記 expired
2. 產生 6 位數隨機驗證碼，計算 code_hash、recno_hash
3. AES-256-GCM 加密 recno
4. 寫入 verification_codes（status=pending，5分鐘後過期）
5. 回傳明文驗證碼供櫃台顯示/列印給病人

---

### POST /api/verify（v1.6 重構）
**用途**：LINE Bot Webhook 收到驗證碼後呼叫

**Request Body**（不需要 recno）：
```json
{ "code": "123456", "lineUserId": "Uxxxxxx" }
```

**Response**：
```json
{ "ok": true, "data": { "linkId": "1" } }
```

**邏輯**（同一個 DB transaction 內完成）：
1. 用 code_hash 查 verification_codes（status=pending）
2. 檢查是否過期、是否已用
3. 解密 recno_encrypted 得到 recno
4. 寫入 line_user_links
5. 寫入 line_user_links_history（action=bind）
6. 標記 verification_codes 為 used
7. 回傳 linkId

---

### POST /api/cleanup
**用途**：排程清理過期驗證碼並歸檔

**Header**：`x-cleanup-api-key: 你的 CLEANUP_API_KEY`

**Response**：
```json
{ "ok": true, "data": { "archived": 10, "deleted": 10 } }
```

---

### POST /api/line-webhook
**用途**：LINE Messaging API Webhook endpoint（接收 LINE 平台事件）

**LINE Developers Console 設定**：
```
Webhook URL: https://lineid-code.zeabur.app/api/line-webhook
```

**處理的訊息類型**：
- 6 位數字 → 當驗證碼處理，呼叫 /api/verify，回覆「✅ 綁定成功」或「❌ 綁定失敗」
- 其他訊息 → 回覆「請輸入收到的 6 位數驗證碼，若無驗證碼請至櫃台索取」

**流程**：
1. LINE middleware 驗 signature（防止偽造）
2. 從 `event.source.userId` 取得 LINE userId
3. 從 `event.message.text` 取得病人輸入的訊息
4. 判斷是否為 6 位數
5. 呼叫 /api/verify（內部呼叫）
6. 用 replyToken 回覆結果

---

## 環境變數（需設定）

```env
# ===== Database =====
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-REGION.pooler.supabase.com:6543/postgres

# ===== 加密金鑰 =====
APP_KEY_V1=YOUR_BASE64_32BYTE_KEY
APP_KEY_CURRENT_VERSION=1

# ===== 驗證碼設定 =====
VERIFY_CODE_TTL_MINUTES=5
VERIFY_MAX_ATTEMPTS=3

# ===== Cleanup API =====
CLEANUP_API_KEY=YOUR_CLEANUP_API_KEY

# ===== LINE Messaging API（LINE Webhook 用）=====
LINE_CHANNEL_SECRET=YOUR_CHANNEL_SECRET
LINE_CHANNEL_ACCESS_TOKEN=YOUR_CHANNEL_ACCESS_TOKEN

# ===== LINE Webhook 內部呼叫 =====
API_BASE_URL=https://lineid-code.zeabur.app
```

---

## 待辦事項

### MVP
- [x] 建立 Supabase 表格（verification_codes、line_user_links、line_user_links_history、verification_codes_archive）
- [x] crypto-utils.js：HMAC-SHA256 / AES-256-GCM / SHA256（含單元測試 36/36 通過）
- [x] index.js：三支 API（/api/create-verify-code、/api/verify、/api/cleanup）
- [x] LINE Webhook handler（/api/line-webhook）
- [x] 完整流程測試（驗證碼 → LINE 輸入 → 綁定成功）
- [x] Python 腳本：讀取 patdb.dbf 並呼叫 /api/create-verify-code（patdb_query.py）

### 正式版
- [x] 排程 Job：每 5 分鐘標記過期驗證碼（/api/cleanup/mark-expired）
- [x] 排程 Job：每天 archive 搬移（/api/cleanup/archive-old）
- [ ] 取消綁定功能
- [ ] 合併回主要 Bot（目前獨立部署於 lineid-code.zeabur.app）

---

## 設計原則

1. **驗證碼明碼不落地**：只在記憶體中用來顯示/列印，比對時用 hash
2. **HMAC secret 與 AES key 分開**：不同金鑰、不同用途
3. **HMAC 取代純 SHA256**：防止離線窮舉攻擊
4. **驗證碼用 code_hash 查表**：LINE Webhook 不需要知道 recno
5. **verify API 同一 transaction 完成所有操作**：避免 race condition
6. **LINE middleware 放 route 第一順位**：signature 驗證需要 raw body
7. **全域不使用 express.json()**：避免 LINE webhook signature 失敗

---

## 查詢範例

```sql
-- 重複綁定檢查（產生驗證碼前）
SELECT * FROM line_user_links WHERE recno_hash = $1 AND status = 'active';

-- 檢查是否有生效中驗證碼
SELECT * FROM verification_codes
WHERE recno_hash = $1 AND status = 'pending' AND expires_at > now();

-- 驗證碼比對（用 code_hash 查表）
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

---

## patdb_query.py（櫃檯驗證碼產生器）

**功能**：Tkinter GUI，讀取 patdb.dbf → 搜尋病人 → 選擇 → 呼叫 API 產生驗證碼

**技術棧**：Python 3 + tkinter + dbfread + requests

**DBF 編碼**：務必使用 `encoding='cp950', char_decode_errors='replace'`
- 舊診所系統的 patdb.dbf header 的 language driver byte 常有誤
- 部分紀錄可能有微小損壞（用 `replace` 將無法解碼 byte 換成 `�`）
- 62,981 筆中約 730 筆有少許異常（1.2%），不影響主流程

**recno 對應**：DBF 的列號（1-indexed），等於病歷號

**執行方式**：
```bash
python patdb_query.py
```

**部署到診所**：修改 `config.json` 中的 `patdbPath` 為 UNC 路徑（如 `\\\\SERVER\\CLINIC\\DATA\\patdb.dbf`）

---

## Job A / Job B 拆解（v1.8）

### 設計動機
`/api/cleanup` 原本把「標記過期」+ 「搬移 archive」 + 「刪除原表」三件事綁在同一個 transaction。缺點：
- 兩件事頻率需求不同（Job A 每 5 分鐘，Job B 每天一次）
- archive 搬移資料量大，5 分鐘跑一次浪費資源且可能鎖表影響正常 API

### 拆解後的 API

#### POST /api/cleanup/mark-expired（Job A，每 5 分鐘）
只做一件事：將 `pending` + 過期的驗證碼標記為 `expired`。獨立 transaction，快速穩定。
```json
Request: POST /api/cleanup/mark-expired
Header: x-cleanup-api-key: YOUR_KEY
Response: { "ok": true, "data": { "updated": 3 } }
```

#### POST /api/cleanup/archive-old（Job B，每天）
將 `used/expired/failed` 記錄搬移到 archive 表（原表刪除），同一 transaction 確保原子性。
```json
Request: POST /api/cleanup/archive-old
Header: x-cleanup-api-key: YOUR_KEY
Response: { "ok": true, "data": { "archived": 10, "deleted": 10 } }
```

#### /api/cleanup（保留，向後相容）
原本的合併版本仍保留，現有呼叫不受影響。

---

## GitHub Actions 排程（.github/workflows/cleanup-jobs.yml）

| Job | 頻率 | 對應 API |
|-----|------|----------|
| mark-expired | 每 5 分鐘 | `/api/cleanup/mark-expired` |
| archive-old | 每天 02:00 UTC（台灣 10:00）| `/api/cleanup/archive-old` |

**需要的 GitHub Secrets**：
- `API_BASE_URL`：https://lineid-code.zeabur.app
- `CLEANUP_API_KEY`：現有的環境變數值

**workflow_dispatch**：可在 GitHub 網頁上手動觸發，適合測試。

**注意**：GitHub Actions cron 不保證精確觸發（可能延遲 1-2 分鐘），對驗證碼（5 分鐘效期）可接受。

---

## 2026-06-29 更新（v1.9）：取消綁定功能實作完成

### 實作內容

#### LINE Bot Webhook（主程式 index.js）
- 新增 `handleQueryBindings`：查詢已綁定就醫資訊，回覆 Flex Carousel
- 新增 `handleViewMedicalInfo`：顯示就醫項目選單（取消綁定 + 4個施工中）
- 新增 `handleUnbindConfirm`：二次確認 Flex
- 新增 `handleUnbindExecute`：串接 lineid_code `/api/unbind` 執行解除
- 新增 `handleUnbindCancel`：取消操作

#### LINE Bot Flex Message 流程
```
圖文選單「查詢就醫資訊」(action=query_bindings)
    ↓
Flex Carousel（顯示所有綁定，藍色「選擇」按鈕）
    ↓
點 [選擇] → Flex 選單（取消綁定 + 4個施工中）
    ↓
點 [取消綁定] → 二次確認
    ↓
點 [是，解除綁定] → ✅ 已解除綁定
```

### 問題修復

| 問題 | 原因 | 解法 |
|------|------|------|
| LINE Flex Message 400 錯誤 | 按鈕的 `style`/`color` 欄位在 footer 多按鈕佈局中會觸發 LINE API 400 錯誤 | 移除 `style`/`color`，單按鈕時可用 |
| handlePostback 條件判斷錯誤 | `data === 'action=view_medical_info'` 永遠為 false（data 是 `action=view_medical_info&link_id=X`） | 改用 `action === 'view_medical_info'`（從 URLSearchParams 解析） |
| Zeabur 部署失敗 | 根目錄缺少 `package.json`，`express` 等依賴未安裝 | 建立 `package.json` 並加入所有必要依賴 |
| 分支不一致 | lineid_code 服務部署在 `line-binding` 分支，但新功能只在 `master` | merge master 到 line-binding |
| 取消綁定點選無反應 | `unbind_confirm` 的 `style`/`color` 造成 LINE 400 錯誤 | 移除所有按鈕的 `style`/`color` |

### Git 分支與部署
- **linebot-mile**（主要 LINE Bot）：部署 `master` 分支
- **lineid-code**（驗證碼 API）：部署 `line-binding` 分支
- 兩分支現已同步（line-binding 已 merge master）

### 待未來實作（修改 index.js 主程式）

| 功能 | 修改檔案 | 說明 |
|------|----------|------|
| 欠單查詢 | `index.js` | 新增 `handleDebtQuery()`，串接 lineid_code 或直接查詢 Supabase |
| 抽血報告 | `index.js` | 新增 `handleBloodReportQuery()` |
| 慢性病資訊 | `index.js` | 新增 `handleChronicDiseaseInfo()` |
| 領藥時間 | `index.js` | 新增 `handleMedicationReminder()` |
| patdb_query.py | `lineid_code/patdb_query.py` | 櫃台端查詢/取消綁定工具（需解密 + 對照本地 patdb.dbf） |

**備註**：這些功能需要先確認資料來源（Supabase 資料表或本地資料庫），再實作對應的 API 和 Flex Message 介面。