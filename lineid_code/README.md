# 賜安診所 LINE 驗證碼系統

## 功能
櫃檯查詢病人資料，點選確認後自動產生 6 位驗證碼，供病人綁定 LINE 帳號。

---

## 檔案結構
```
lineid/
├── patdb_query.py      # 主程式
├── config.json          # 設定檔（請從 config.example.json 修改）
├── config.example.json  # 設定範本
├── logs/               # 日誌（程式自動建立）
└── README.md           # 本說明
```

---

## 首次安裝（在掛號電腦上安裝 Python）

### 步驟 1：安裝 Python 3
1. 從 https://www.python.org/downloads/ 下載 Python 3.8 或更新版本
2. **安裝時務必勾選「Add Python to PATH」**（重要！）
3. 安裝完成後開啟命令列（按 `Win+R`，輸入 `cmd`，按 Enter）

### 步驟 2：安裝所需套件
在命令列輸入：
```
pip install dbfread requests
```

### 步驟 3：確認網路硬碟路徑
向資訊人員確認 patdb.dbf 的完整 UNC 路徑，例如：
- `\\192.168.1.100\clinic\patdb.dbf`
- `\\看診電腦名稱\C$\CLINIC\DATA\patdb.dbf`

### 步驟 4：修改設定檔
用記事本開啟 `config.json`，修改 `patdbPath`：
```json
{
  "patdbPath": "\\\\192.168.1.100\\clinic\\patdb.dbf",
  "apiBaseUrl": "https://lineid-code.zeabur.app",
  "logDir": "logs"
}
```
**注意**：`\\` 是 JSON 格式要求，路徑中每個 `\` 要打成 `\\`。

### 步驟 5：測試執行
在命令列進入本資料夾，執行：
```
python patdb_query.py
```
看到「已載入 X 筆資料」表示成功。

### 步驟 6：建立捷徑（可選）
在桌面上建立 `patdb_query.py` 的捷徑，未來直接點兩下就能開。

---

## 換電腦後的設定

新掛號電腦需要做的動作：
1. 重複「步驟 1、2」（已安裝過可跳過）
2. 把本資料夾複製到新電腦
3. 修改新電腦上的 `config.json`，確認 `patdbPath` 正確
4. 執行 `python patdb_query.py` 確認正常

---

## 操作流程
1. 在搜尋框輸入「姓名」或「身分證」或「生日」
2. 按 Enter 或點「查詢」
3. 在清單中雙擊選擇正確的病人
4. 系統自動呼叫 API 產生驗證碼並顯示
5. 告知病人拿手機到 LINE 輸入驗證碼

---

## 常見問題

**Q: 出現「patdb 檔案不存在」**
→ 檢查 `config.json` 中的路徑是否正確，確認看診電腦已開機且網路可連線。

**Q: 出現「無法連線到 API 伺服器」**
→ 確認網路正常。需允許對 `lineid-code.zeabur.app:443` 的 HTTPS 連線。

**Q: 驗證碼過期了**
→ 驗證碼有效時間為 5 分鐘，過期後需重新查詢並產生。

---

## 技術資訊

- **主程式**：patdb_query.py（Python 3 + tkinter）
- **API 位置**：https://lineid-code.zeabur.app
- **日誌位置**：本資料夾下的 `logs/YYYY-MM-DD.log`
- **必要套件**：dbfread、requests
- **patdb 編碼**：cp950（舊診所系統格式）

如有問題請聯絡資訊人員。