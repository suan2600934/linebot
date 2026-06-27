# 最終流程（最新版共識 — 驗證碼方案，取代 QR Code / Account Link）

> **本次重大變更說明**
> 原方案使用「LINE Account Link + issueLinkToken + QR Code」，但技術上卡關：
> `issueLinkToken` 需要先知道 `userId` 才能呼叫，而診所端在櫃台階段只有 `recno`，沒有 `userId`，邏輯上無法成立。
> 且此流程方向與 LINE 官方 Account Link 設計（必須由使用者在 LINE 端主動觸發）相反。
>
> **新方案改為：櫃台核對身分 → 產生短效驗證碼 → 病人在 LINE 對話框輸入驗證碼完成綁定。**
> 這樣 userId 與 recno 的串接時機，從「綁定前」改成「綁定發生的那一刻」，技術上沒有卡點，
> 且因為有人工身分核對（雙證件 + 員工 + 多人monitoring + 確認畫面），驗證強度比單純掃 QR Code 更高。

---

## Step 1 病人查詢
櫃台開啟「LINE綁定系統」，輸入任一資訊：
- 身份證號
- 手機號碼
- 病歷號
- 出生年月日
- 姓名

例如：`0912345678`

---

## Step 2 查詢 patdb.dbf
Python 程式查詢：`G:\RS\patdb.dbf`，找到符合病人。

---

## Step 3 顯示病人資料
例如：
- 姓名：王大明
- 出生日期：75/05/01
- 病歷號：003245
- LINE狀態：未綁定

---

## Step 4 病人身分核對（第一層防護）
病人持**雙證件**至櫃台，員工核對證件確認本人。
員工與病人**一起看著掛號畫面**，確認/輸入病歷號（recno），並有**多人monitoring**降低人為輸入錯誤。

病人本人最終確認：「**是我本人**」

> 這一步非常重要，是第一層身份確認。

---

## Step 5 重複綁定檢查

> **分工說明：這一步與 LINE 完全無關，純粹是「櫃台 Python 程式 ⇄ Zeabur 後端」之間的事。**

1. **櫃台 Python 程式**：病人確認本人後，員工按下「產生綁定驗證碼」，呼叫 Zeabur API 並傳送 `recno`
   ```
   POST /api/create-link
   { "recno": "003245" }
   ```

2. **Zeabur 後端**（在產生驗證碼**之前**先做檢查）：
   - 拿明文 `recno` 計算 `recno_hash = HMAC-SHA256(recno, secret)`
   - 查 `line_user_links` 表，看是否已有對應綁定紀錄
   - 若**已綁定** → 回傳 `{ "status": "already_linked", "message": "此病人已綁定過LINE" }`，**不**直接產生驗證碼
   - 若**未綁定** → 正常產生驗證碼，回傳給櫃台程式顯示

3. **櫃台 Python 程式收到回應後**：
   - 若收到 `already_linked` → 畫面跳出提示，員工口頭詢問病人「您之前有綁定過喔！請問是換了新帳號、還是之前幫別人綁錯了呢？」，員工確認後按下「繼續/更新綁定」，**才再呼叫一次API**（帶上強制更新參數），由後端執行 Upsert（覆蓋舊紀錄）
   - 若沒問題 → 直接顯示驗證碼給病人
✅ 新增綁定(核心):查詢病人 → 驗證碼 → LINE webhook比對 → 寫入 line_user_links
✅ 重複綁定檢查(Step 5,查詢用,不算新功能,只是多一個if判斷)
🔲 上線測試、跑通MVP
🔲 更新綁定(Upsert覆蓋舊紀錄)——最後做
🔲 取消綁定(刪除/停用某筆line_user_links紀錄)——最後做,且要先決定UX(例如LINE裡要不要做一個「解除綁定」的圖文選單按鈕,還是只能由診所端操作)

保留「重複綁定 / 更新綁定」彈性的三個實務情境：

1. **病人換了新 LINE 帳號**（最常見）：換手機、忘記密碼、換門號，常直接重新註冊新 LINE 帳號，對 LINE 而言是全新自然人，會產生全新 userId，舊的綁定必須能被覆蓋更新。
2. **家屬代綁定的權限轉移**：例如原本兒子用自己的LINE幫年長父親綁定，之後父親想改用自己的LINE；或媽媽幫年幼小孩綁定，小孩長大後需要移轉成自己的LINE。
3. **防呆與系統容錯**：櫃台忙中有錯綁錯人，事後需要透過更新機制修正。

> 若病人只是正常換手機、LINE帳號不變，userId不變，**不需要**回診所重新綁定。

---

## Step 6 呼叫 Zeabur API 產生驗證碼
Python：
```
POST /api/create-link
傳送：
{
  "recno": "003245"
}
```

> 此階段是「診所電腦 ⇄ Zeabur」之間的通訊，必須使用 **HTTPS (TLS)**。

---

## Step 7 產生短效驗證碼
Zeabur 產生 **6位純數字驗證碼**，例如：`482917`

規格：
- 6位純數字（不用字母，避免0/O、1/I混淆，方便長輩輸入）
- **5分鐘**有效期
- 同一 recno 若有舊碼未過期，產生新碼時直接覆蓋舊碼使其失效（全院同recno僅一組有效碼）

---

## Step 8 建立 pending_links 暫存紀錄
Supabase：

| code | recno | expire_at | attempt_count | status |
|---|---|---|---|---|
| 482917 | 003245 | 5分鐘後 | 0 | pending |

> 此階段可接受明文 recno（或加密後存，視安全要求），因存活時間極短，綁定完成或過期即失效。

---

## Step 9 畫面顯示驗證碼與操作提示
螢幕顯示：

> 您的綁定驗證碼是：**482917**（5分鐘內有效）
> 請用您的手機開啟 LINE，加入官方帳號好友（若尚未加入），並在對話框輸入此驗證碼完成綁定。

---

## Step 10 病人在 LINE 端操作
病人當場拿手機：
1. 開啟 LINE，加官方帳號好友（若未加）
2. 在對話框輸入驗證碼 `482917`

> 因為是病人**主動**在LINE裡發送訊息，LINE 端這時自然會帶有該病人的 `userId`，
> 解決了「之前不知道 userId」的技術卡點。

---

## Step 11 LINE 發送 webhook 給 Zeabur
LINE Webhook 範例（文字訊息事件）：
```json
{
  "type": "message",
  "source": {
    "userId": "Uxxxxxxxx"
  },
  "message": {
    "type": "text",
    "text": "482917"
  }
}
```

---

## Step 12 後端比對驗證碼
Zeabur 收到 `userId` + 輸入文字（驗證碼）：

1. 查 `pending_links`，確認該驗證碼是否存在、未過期、status為 `pending`
2. 若驗證碼錯誤 → `attempt_count + 1`；**累計錯誤滿3次** → 該碼直接失效（status改為 `failed`），需回櫃台重新產生新碼
3. 若驗證碼正確且未過期 → 取得對應的 `recno`，準備建立正式綁定
4. 回覆病人 LINE 訊息：「綁定成功！」或「驗證碼錯誤，您還有 X 次機會」等提示

---

## Step 13 建立正式綁定
找到：`驗證碼` → `recno`，搭配 webhook 帶來的 `userId`，建立：

> **LINE User ID ↔ 病歷號**

寫入 `line_user_links`：
- `encrypted_line_id`（AES-256-GCM 加密 userId）
- `encrypted_recno`（AES-256-GCM 加密 recno）
- `user_id_hash`（SHA-256，查詢索引）
- `recno_hash`（HMAC-SHA256，查詢索引，供 Step 5 重複綁定檢查使用）

同時將 `pending_links` 該筆紀錄 status 改為 `used`，**不刪除**，保留稽核軌跡。

---

# 哪些資料需要加密？

## 不需要加密的資料

**驗證碼（code）**
- 只存在5分鐘，一次性使用，且本身無法直接識別病人 → 不需加密（可視需求存hash）

## 必須加密的資料

**1. LINE User ID**
例：`U4a8d7fxxxxxxxx`
原因：可直接識別特定病人，屬於個人資料。
儲存前 AES-256-GCM 加密 → 資料庫欄位：`encrypted_line_id`

**2. 病歷號（RECNO）**
例：`003245`
原因：可對應到完整病歷，應視為敏感資料。
儲存前 AES-256-GCM 加密 → 資料庫欄位：`encrypted_recno`

## 為什麼選 AES-256-GCM？
- 不要用 AES-256-CBC
- 建議 AES-256-GCM：現代標準、同時提供加密與完整性驗證、Node.js原生支援、效能足夠、醫療系統常用

## 哪些資料適合 Hash？

**LINE User ID 查詢索引**
收到 webhook 的 `userId` 後，若每次都解密整張表查找會很慢，因此另存：
```
user_id_hash = SHA256(line_user_id)
```
查詢流程：LINE User ID → SHA256 → 查 user_id_hash → 找到資料，不需全表解密。

**病歷號查詢索引（Step 5 重複綁定檢查用）**
```
recno_hash = HMAC-SHA256(recno, secret)
```

## AES 金鑰放哪裡？
- 放 Zeabur 環境變數：`AES_SECRET_KEY=xxxxxxxxxxxxxxxx`
- **不要**放 GitHub、程式碼、Supabase

---

# 資料庫最終設計

## pending_links
| 欄位 | 說明 |
|---|---|
| id | PK |
| code | 驗證碼（6位數字，可存明碼或hash） |
| recno | 病歷號（明文或加密，視安全要求） |
| expire_at | 5分鐘後過期 |
| attempt_count | 已錯誤嘗試次數，預設0 |
| status | pending / used / expired / failed |
| created_at | 建立時間 |
| used_at | 綁定成功時間（nullable） |

> 此表存活時間極短，且設計上需 pg_cron 或排程定期清理過期資料（例如7天以上）。

## line_user_links
| 欄位 | 說明 |
|---|---|
| id | PK (uuid) |
| user_id_hash | SHA256，唯一索引（UNIQUE INDEX），用於LINE Webhook快速反查 |
| recno_hash | HMAC-SHA256，索引（INDEX），用於櫃台Step 5重複綁定檢查 |
| encrypted_line_id | AES-256-GCM加密字串（含IV與AuthTag） |
| encrypted_recno | AES-256-GCM加密字串（含IV與AuthTag） |
| linked_at | 建立時間，預設now() |
| updated_at | 更新時間 |

> 設計為一對多：一個LINE可綁多個recno、一個recno可被多個LINE綁定（無唯一約束限制兩者對應關係，僅靠 user_id_hash + recno_hash 組合查詢）。

---

# 🛠 系統實作規格 & 核心檢查清單

## 關鍵密碼學實作標準（Node.js / Zeabur 端）

**Hash 實作**
- userId 索引：統一使用 `crypto.createHash('sha256')`
- recno 索引：建議使用 `crypto.createHmac('sha256', secret)`，加固定密鑰防止彩虹表攻擊

**AES-256-GCM 實作**
- 每次加密必須產生隨機且不重複的 IV（至少12 bytes）
- 資料庫儲存格式建議：`iv.hex() + ":" + encryptedData.hex() + ":" + authTag.hex()`

**驗證碼安全機制**
- 6位純數字，5分鐘有效期
- 累計錯誤輸入滿3次即失效
- 同recno新碼產生時，舊碼立即失效（覆蓋）

## 開發階段檢視

| 階段 | 實作重點檢查 | 狀態 |
|---|---|---|
| V1 MVP（跑通流程） | 🟢 櫃台讀取 patdb.dbf 並透過 HTTPS 呼叫 Zeabur | 🔲 待開發 |
| | 🟢 Zeabur 產生驗證碼並寫入 pending_links | 🔲 待開發 |
| | 🟢 病人於LINE輸入驗證碼，Zeabur能正確比對並完成綁定 | 🔲 待開發 |
| V1 正式版（資安強化） | 🔐 加上 AES-256-GCM 加密與 SHA-256 / HMAC-SHA256 索引欄位 | 🔲 待開發 |
| | 🔐 實作 Step 5 的「重複綁定檢查」（拿 recno_hash 查庫） | 🔲 待開發 |
| | 🔐 設定 pending_links 的過期清理機制（pg_cron 或排程） | 🔲 待開發 |
| | 🔐 驗證碼錯誤次數限制與失效機制 | 🔲 待開發 |

---

# 最終結論

目前最合理的架構是：

```
病人查詢
  ↓
身份核對（雙證件 + 員工 + 多人monitoring）+ 病人確認資料
  ↓
重複綁定檢查（recno_hash）
  ↓
產生6位數驗證碼（5分鐘有效）
  ↓
病人於LINE對話框輸入驗證碼
  ↓
LINE Webhook 帶來 userId
  ↓
後端比對驗證碼 → 取得對應 recno
  ↓
AES-256-GCM 加密 userId 與 recno
  ↓
存入 Supabase（line_user_links）
```

真正需要加密的核心資料只有兩個：
- LINE User ID → AES-256-GCM
- 病歷號 RECNO → AES-256-GCM

另外建立查詢索引：
- `SHA-256(LINE User ID)` → user_id_hash
- `HMAC-SHA256(RECNO)` → recno_hash

AES金鑰只存放於 Zeabur 環境變數，與 Supabase 資料庫完全分離。

此方案相較原 QR Code / Account Link 方案：
- ✅ 不需要 `issueLinkToken`，沒有「先有userId才能產生連結」的技術卡點
- ✅ 驗證強度更高（人工雙證件核對 + 短效驗證碼雙重防護）
- ✅ 流程對長輩/不熟手機操作者更直覺（輸入數字 vs 掃描+確認）
- ✅ 已符合醫療資訊系統合理且安全的架構需求
