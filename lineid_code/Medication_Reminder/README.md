# 慢性病用藥查詢系統

## 目錄結構

```
Medication_Reminder/
├── sync_chronic.py       # 同步腳本（每 7 天執行）
├── config.example.json   # 設定檔範例
├── README.md             # 本檔案
└── config.json           # （複製 config.example.json 後修改）
```

## 初次設定

### 1. 複製並修改設定檔

```bash
copy config.example.json config.json
```

編輯 `config.json`，確認以下路徑正確：
- `slowRecPath`：診間電腦的 slow_rec.dbf 路徑

### 2. 在 Supabase 建立資料表

在 Supabase Dashboard → SQL Editor 執行：
- `database/chronic_prescriptions_date.sql`

### 3. 測試同步

```bash
python sync_chronic.py
```

確認 log 中顯示「同步完成」。

## 排程設定（Windows Task Scheduler）

建立工作排程，每 7 天執行一次：

```
程式：python
引數：H:\opencode\linebot\lineid_code\Medication_Reminder\sync_chronic.py
起始：H:\opencode\linebot\lineid_code\Medication_Reminder\
```

或使用 Windows 工作排程器的「建立基本工作精靈」。

## 同步邏輯

1. 讀取 `slow_rec.dbf` 近 90 天內所有記錄
2. 依 `CODE` 分組，取 `DATE` 最大的（目前在效期內的慢連箋）
3. 從群組中取出 `S_SERNO=1/2/3` 的 `S_DATE`（各次領藥日）
4. 計算過期日（`第1次領藥日 + total_days - 1`）
5. Upsert 到 Supabase `chronic_prescriptions_date` 表

## LINE Bot 回覆格式

```
【慢性病用藥查詢】

就醫卡號：0*****7

第1次領藥：114/05/01（已領）
第2次領藥：114/05/31（已領）
第3次領藥：114/06/28（建議領藥日）

處方效期：至 114/08/02
⚠️ 還有 27 天效期，請在過期前完成第 3 次領藥
```

### 建議領藥日計算

| 次數 | 30天制 | 28天制 |
|------|--------|--------|
| 第2次 | 第1次 + 22~28 天 | 第1次 + 20~24 天 |
| 第3次 | 第1次 + 50~56 天 | 第1次 + 48~52 天 |

### 逾時提醒

- 第2次：未領 + 建議日已過 → ⚠️ 第2次已逾期，請盡快領藥
- 第3次：未領 + 建議日已過 → ⚠️ 第3次已逾期，請盡快領藥
- 處方已過期 → ⚠️ 處方已過期，請回診

## 部署檢查清單

- [ ] `slow_rec.dbf` 路徑正確
- [ ] Supabase `chronic_prescriptions_date` 資料表已建立
- [ ] `chronic_prescriptions_date_upsert` RPC function 已建立
- [ ] 排程工作已設定（每 7 天）
- [ ] 測試執行成功