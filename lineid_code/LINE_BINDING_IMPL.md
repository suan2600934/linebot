# LINE 帳號綁定系統 — 實作紀錄

## 📅 最後更新：2026-07-11（v1.15）

---

## 📋 patdb_query.py UI 流程總覽（v1.15）

### 佈局結構

```
patdb_query.py（Tkinter）
├── 分頁 1：驗證碼產生（Tab 1，Canvas 滾動式）
│   ├── Row 0: 標題「賜安診所 LINE 綁定驗證碼系統」
│   ├── Row 1: 紅色提示「請先選 A 再選 B」
│   ├── Row 2: 【A】綁定人（操作 LINE 的人）
│   │   ├── 搜尋框 + 查詢/清除
│   │   ├── Listbox（雙擊選擇）
│   │   └── binder_info_label：「（尚未選擇）」（藍字）
│   ├── Row 3: 分隔線
│   ├── Row 4: 【B】被綁定人（要看診的病人）
│   │   ├── 搜尋框 + 查詢/清除
│   │   ├── Listbox（雙擊選擇）
│   │   └── info_label：「（尚未選擇）」（藍字）
│   ├── Row 5: [確認並產生驗證碼]（disabled → normal）
│   ├── Row 6: confirm_label：顯示「【A】xxx 將綁定 【B】yyy（RECNO）」
│   └── Row 7: ┌─ 驗證碼 ──────────────┐
│       │    （尚未產生）/ 123456    │  ← code_label（紅字大字）
│       │    有效期至：xxx           │  ← expiry_label
│       │    [複製驗證碼]            │
│       │    [確認 LINE 綁定]        │  ← 灰色 → 藍底（enabled）
│       │    （等待 LINE 綁定...）    │  ← line_bind_status（紅字）
│       └───────────────────────────────┘
│
└── 分頁 2：綁定管理
    ├── 查詢方式（全部/依綁定人/依被綁定人/依時間）
    ├── 關鍵字搜尋
    ├── Listbox（雙擊選擇）
    ├── [刷新列表] [解除綁定]
    └── 櫃台引導提示
```

### 按鈕樣式

| 按鈕 | 預設（disabled） | 啟用（normal） | 備註 |
|------|----------------|---------------|------|
| 確認並產生驗證碼 | 灰色按鈕 | 深色按鈕 | 選 A+B 後啟用 |
| 確認 LINE 綁定 | `ConfirmLineDisabled.TButton`（灰底灰字） | `ConfirmLine.TButton`（藍底白字粗體） | 驗證碼產生後啟用 |
| 複製驗證碼 | 淺灰按鈕 | 淺灰按鈕 | 驗證碼產生後可點 |
| 選擇此人為綁定人 / 被綁定人 | 深色按鈕 | 深色按鈕 | 隨時可點 |

### generate_code() 執行順序（2026-07-11 重構後）

```python
def generate_code():
    # 1. 計算 recno_hash
    recno_hash = compute_recno_hash(recno, APP_KEY_V1)

    # 2. 檢查本地重複綁定（若已綁過 → 警告後 return）
    existing = check_existing_binding(binder_name, recno_hash)
    if existing:
        messagebox.showwarning("重複綁定")
        return

    # 3. API 產生驗證碼
    result = call_create_verify_code(apiBaseUrl, recno)

    # 4. 顯示驗證碼 + 更新 code_label + 複製到剪貼簿
    code_label.config(text=code)
    root.clipboard_append(code)

    # 5. 立即檢查 LINE 綁定狀態（UNBIND_API_KEY 存在時）
    if UNBIND_API_KEY in config:
        link_result = call_get_link_by_recno_hash(recno_hash, UNBIND_API_KEY)
        if link_result["data"]:  # 已有綁定
            save_binding_record(...)      # 直接寫入本地
            messagebox.showinfo("LINE 已有有效綁定，本地記錄已儲存！")
            return                          # ← 提早結束，不走等待流程

    # 6. LINE 尚未綁定 → 啟用等待流程
    pending_binding_info = {...}
    confirm_line_btn.config(state="normal", style="ConfirmLine.TButton")  # 藍色
    line_bind_status.config(text="等待 LINE 綁定確認：A → B", foreground="red")
    root.update()
    messagebox.showinfo("請到 LINE 輸入驗證碼，完成後點「確認 LINE 綁定」")
```

### confirm_line_binding() 執行順序

```python
def confirm_line_binding():
    # 1. 檢查 pending_binding_info 是否存在
    # 2. 查 LINE 連結：GET /api/admin/links-by-recno-hash
    link_result = call_get_link_by_recno_hash(recno_hash, UNBIND_API_KEY)

    if link_result["data"]:  # 已有綁定
        save_binding_record(...)  # 寫入本地 SQLite
        confirm_btn.config(state="disabled", style="")  # 恢復灰色
        line_bind_status.config(text="", foreground="gray")
        messagebox.showinfo("LINE 綁定成功，本地記錄已儲存！")
    elif link_result["data"] is None:  # 還沒綁定
        messagebox.showwarning("LINE 尚未完成綁定")
```

### 修復記錄（patdb_query.py）

| 日期 | 問題 | 解法 |
|------|------|------|
| 2026-07-09 | LINE 綁定成功但本地資料庫未寫入 | 重構為「先確認 LINE 再寫入本地」 |
| 2026-07-09 | `recno_hash` 為空導致 `on_unbind_select` 爆炸 | 從 `recno` 重新計算 |
| 2026-07-11 | 訊息框 blocking 導致按鈕樣式變化看不見 | 訊息框前加 `root.update()` |
| 2026-07-11 | 視窗太小看不到「驗證碼」區塊 | Tab1 改用 Canvas + Scrollbar |
| 2026-07-11 | 按鈕初始狀態就是藍色，無法區分 | 初始用 `ConfirmLineDisabled.TButton`（灰） |
| 2026-07-11 | 藍色按鈕外觀變化不明顯 | `root.update()` + 訊息後出讓 UI 先重繪 |

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
| ~~抽血報告~~ | `index.js` | ✅ 改為「抽血日期查詢」→ `handleBloodTestQuery()` ✅ 2026-07-10 |
| 慢性病資訊 | `index.js` | 新增 `handleChronicDiseaseInfo()` |
| ~~領藥時間~~ | `index.js` | ✅ 改為「慢性病領藥查詢」→ `handleChronicPrescriptionQuery()` ✅ 2026-07-09 |
| patdb_query.py | `lineid_code/patdb_query.py` | 櫃台端查詢/取消綁定工具（需解密 + 對照本地 patdb.dbf） |

**備註**：這些功能需要先確認資料來源（Supabase 資料表或本地資料庫），再實作對應的 API 和 Flex Message 介面。

---

### 2026-06-30 待實作（v1.10）：patdb_query.py 本地綁定記錄功能

#### 需求背景
一個 LINE 帳號可能綁定多個病歷號（家人代辦），僅靠「綁定時間」無法確認要解除的是哪一筆。
需要在**綁定當下**就記錄病患姓名 + 病歷號 + 綁定時間，存到本地資料庫。

#### 程式路徑
| 程式 | 路徑 | 部署到 |
|------|------|--------|
| 主程式 LINE Bot | `H:\opencode\linebot\index.js` | `linebot-mile.zeabur.app` |
| LINE 綁定 API | `H:\opencode\linebot\lineid_code\index.js` | `lineid-code.zeabur.app` |
| 櫃台工具 | `H:\opencode\linebot\lineid_code\patdb_query.py` | 本地執行 |

#### 實作方向

在 `patdb_query.py` 新增「綁定管理」Tab，使用本地 SQLite 或 JSON 檔案儲存綁定記錄。

**本地資料欄位（綁定時記錄）**：
| 欄位 | 說明 |
|------|------|
| `id` | 自增 ID |
| `patient_name` | 病患姓名 |
| `recno` | 病歷號 |
| `recno_hash` | HMAC-SHA256(recno, APP_KEY) |
| `binding_time` | 綁定時間 |
| `status` | active / unbound |

#### 解除時完整流程

```
輸入綁定時間 → 查到本地記錄
    ↓
用 recno_hash 查 line_user_links（需新建 internal API）
    ↓
取得 linkId
    ↓
呼叫 /api/unbind { linkId }
    ↓
完成
```

**優點**：
- 不需要等 /api/verify 完成後才知道 linkId
- 解除時動態查詢
- /api/unbind 邏輯完全不需要改

#### 需要新增的功能

**1. 查詢 linkId by recno_hash（新增 API）**
- `GET /api/admin/links-by-recno-hash` - 傳入 recno_hash，回傳 linkId
- 需要 UNBIND_API_KEY 驗證
- 查 line_user_links WHERE recno_hash = $1 AND status = 'active'

**2. patdb_query.py 新增功能**
- 新增「綁定管理」Tab
- 綁定時：選擇病人 → 記錄 patient_name + recno + recno_hash + binding_time → 存入本地資料庫 → 產生驗證碼
- 解除時：輸入綁定時間 → 查到本地記錄 → 呼叫 GET /api/admin/links-by-recno-hash → 取得 linkId → 呼叫 /api/unbind { linkId }

**API Key 設計**：
- `/api/admin/links-by-recno-hash` - 新增，需 UNBIND_API_KEY 驗證
- `/api/admin/unbind` - 新增，需 UNBIND_API_KEY 驗證
- `/api/unbind` - 維持無 key（給 LINE Webhook 用）

#### 櫃台引導
查到記錄後，畫面顯示「請病人在 LINE 的『查詢就醫資訊』中操作解除」。

---

## Debug Tools（2026-07-05）

| 用途 | URL |
|------|-----|
| 查詢用戶所有綁定 | `https://lineid-code.zeabur.app/api/query-bindings?lineUserId=LINE用戶ID` |
| 查詢 linkId by recno_hash | `https://lineid-code.zeabur.app/api/admin/links-by-recno-hash?recno_hash=xxx`（需 x-unbind-api-key） |

---

## 2026-07-06 更新（v1.11）：patdb_query.py 增强

### 新增功能

#### 1. 支援「綁定人 A → 被綁定人 B」一对一关系

**流程变更**：
```
舊流程：選病人 → 產生驗證碼
新流程：選綁定人A → 選被綁定人B → 檢查是否重複 → 產生驗證碼
```

#### 2. 本地 SQLite Schema 更新

```sql
CREATE TABLE binding_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    binder_name TEXT NOT NULL,        -- 綁定人姓名
    binder_idno TEXT,                 -- 綁定人身分證
    binder_birth TEXT,                -- 綁定人生日（6位數如490101）
    patient_name TEXT NOT NULL,       -- 被綁定人姓名
    patient_idno TEXT,                -- 被綁定人身分證
    patient_birth TEXT,                -- 被綁定人生日
    recno TEXT NOT NULL,              -- 病歷號
    recno_hash TEXT NOT NULL,
    binding_time TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TEXT
)
```

#### 3. 重複綁定檢查

產生驗證碼前檢查本地資料庫是否已有相同「綁定人 + 被綁定人」的 active 記錄。

#### 4. Tab2 查詢方式

| 模式 | 說明 |
|------|------|
| 全部 | 顯示所有有效綁定 |
| 依綁定人 | 搜尋 binder_name / binder_idno / binder_birth |
| 依被綁定人 | 搜尋 patient_name / patient_idno / patient_birth / recno |
| 依時間 | 輸入 2026-07-06 格式 |

#### 5. 日期格式顯示

- 輸入：6位數如 `490101`（民國年MMdd）
- 顯示：自動轉換為 `49/01/01` 格式

### UI 提示說明

**Tab1（驗證碼產生）**：
- 標籤：`搜尋（姓名/身份證/生日）：`
- 提示：`💡 生日請輸入6位數，如：490101，顯示會自動轉為 49/01/01`

**Tab2（綁定管理）**：
- 關鍵字搜尋提示：`💡 姓名/身份證/生日/RECNO 任一字元符合即符合。生日請輸入6位數，如：490101。`
- 時間搜尋提示：`💡 格式：2026-07-05 任一字元符合即可`

### 顯示格式

```
【A】張大明(生日:49/01/01/ID:A123456789) 綁定 【B】陳大同(生日:52/06/18/ID:B987654321) | RECNO：003245 | 綁定時間：2026-07-06
```

### 新增函式

| 函式 | 用途 |
|------|------|
| `format_birth(birth)` | 將 490101 轉換為 49/01/01 |
| `check_existing_binding(binder_name, recno_hash)` | 檢查是否重複綁定 |
| `search_binding_records(keyword, search_type)` | 支援姓名/身份證/生日/RECNO 搜尋 |
| `on_binder_select()` | 選擇綁定人 |
| `on_confirm_and_generate()` | 確認後產生驗證碼 |

### 備註

- 本地資料庫 `bindings.db` 需刪除後重新建立（schema 有變更）
- 雲端資料庫 `line_user_links` 無需變更（不同架構）
- 所有個人資料僅存於本地，不上傳雲端

---

## 2026-07-07 更新（v1.12）：慢性病領藥查詢 - 新增 /api/admin/recno-by-link

### 需求背景

LINE Bot「慢性病用藥查詢」功能需要透過 `link_id` 查詢完整 `recno`，但現有 `/api/query-bindings` 只回傳遮罩過的 recno（如 `036****87`）。

### 解決方案

新增一支內部 API `GET /api/admin/recno-by-link`，由 LINE Bot 在收到「慢性病查詢」時呼叫。

### API 規格

```
GET /api/admin/recno-by-link?link_id=xxx
Header: x-unbind-api-key: <key>

Response:
{ "ok": true, "data": { "recno": "036787" } }
或
{ "ok": false, "error": "找不到" }
```

### 實作狀態

✅ **已實作**（2026-07-07）

實作位置：`lineid_code/index.js:610-636`

### 邏輯

1. 驗證 `x-unbind-api-key`
2. 根據 `link_id` 查詢 `line_user_links` 表
3. 解密 `encrypted_recno` 取得完整 recno
4. 回傳

### 病歷號遮罩格式

LINE Bot 顯示給用戶時，recno 需去識別化：
- 格式：`第一碼*****最後一碼`
- 範例：`036787` → `0*****7`

```javascript
// 遮罩函式
function maskRecno(recno) {
  if (!recno || recno.length < 3) return recno;
  return recno[0] + '*****' + recno.slice(-1);
}
```

---

## 2026-07-08 更新（v1.13）：慢性病領藥查詢 LINE Bot 實作完成

### 系統架構

```
LINE Bot 圖文選單「查詢就醫資訊」
    ↓
Flex Carousel（顯示所有綁定，藍色「選擇」按鈕）
    ↓
點 [選擇] → Flex 選單（5個按鈕）
    ↓
點 [💊 慢性病領藥查詢] → action=chronic_prescription_query&link_id=xxx
    ↓
LINE Bot 呼叫 lineid_code /api/admin/recno-by-link 取得完整 recno
    ↓
LINE Bot 查詢 Supabase chronic_prescriptions_date 表
    ↓
回覆慢連箋領藥資訊
```

### 資料來源

| 來源 | 說明 |
|------|------|
| `slow_rec.dbf` | 診所HIS慢連箋領藥紀錄（每7天同步一次） |
| `chronic_prescriptions_date` | Supabase 同步後的慢連箋資料表 |

### Supabase 資料表

```sql
CREATE TABLE chronic_prescriptions_date (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) NOT NULL,           -- 病歷號
    first_date VARCHAR(10) NOT NULL,     -- 首次開立日期（ROC格式，如 1150701）
    total_days INTEGER NOT NULL,         -- 總天數（90 或 84）
    per_days INTEGER NOT NULL,            -- 每次給藥天數（30 或 28）
    serno1_date VARCHAR(10),             -- 第1次領藥日期（NULL=未領）
    serno2_date VARCHAR(10),             -- 第2次領藥日期
    serno3_date VARCHAR(10),             -- 第3次領藥日期
    expire_date VARCHAR(10) NOT NULL,    -- 過期日（計算值）
    synced_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(code)
);
```

### ROC 日期格式

| 格式 | 來源 | 範例 |
|------|------|------|
| DBF 原始（6字元含A/B前綴） | slow_rec.dbf DATE/S_DATE 欄位 | `B50701` |
| Supabase 儲存（7位數） | sync_chronic.py 輸出 | `1150701` |
| LINE Bot 顯示 | 轉換後 | `2026/07/01` |

**格式轉換邏輯**：
- `B50701` → B=11, year_digit=5 → ROC 115年 → `1150701`（存入 Supabase）
- `1150701` → ROC 年=115 → 西元 2026年 → `2026/07/01`（顯示給病人）

### 回覆格式

```
【慢性病領藥查詢】

就醫卡號：0*****7

第1次領藥：2026/07/01（已領）
第2次領藥：2026/07/31（建議領藥日）
第3次領藥：2026/08/28（建議領藥日）

處方效期：至 2026/09/28
⚠️ 還有 27 天效期，請在過期前完成第 3 次領藥
```

### 逾時未領藥提醒邏輯

| 情境 | 顯示 |
|------|------|
| 第2次：未領 + 建議日已過 | `（⚠️ 逾期未領）` |
| 第3次：未領 + 建議日已過 | `（⚠️ 逾期未領）` |
| 處方已過期 | `⚠️ 處方已過期，請回診` |
| 效期 ≤ 30 天 | `⚠️ 還有 N 天效期，請在過期前完成領藥` |

### 實作檔案

| 檔案 | 說明 |
|------|------|
| `index.js`（LINE Bot 主程式） | `handleChronicPrescriptionQuery()` 函式（line 1149-1271） |
| `lineid_code/index.js` | `/api/admin/recno-by-link` API（line 610-636） |
| `Medication_Reminder/sync_chronic.py` | 同步腳本（每7天排程） |
| `database/chronic_prescriptions_date.sql` | 資料表 + RPC function 定義 |

### 建議領藥日計算

- **第2次建議日**：serno1_date + (per_days === 28 ? 22 : 26) 天
- **第3次建議日**：serno1_date + (per_days === 28 ? 50 : 53) 天
- **過期日**：serno1_date + total_days - 1 天

### 同步頻率

| 事件 | 頻率 |
|------|------|
| slow_rec.dbf → Supabase | 每 7 天（排程） |
| LINE Bot 查詢 | 即時（病人點選時） |

### 待驗證

- [ ] Zeabur 部署完成後，確認 LINE Bot 回覆正確
- [ ] 確認有慢連箋記錄的病人可查到正確資訊
- [ ] 確認無記錄的病人回覆「最近三個月內查無慢性病領藥記錄。」