# Google Apps Script API

這份程式提供畢業旅行查詢系統的後端 API。

目前採用 TypeScript + clasp 本地開發流程。

請修改：

- `gas/src/Code.ts`

不要直接修改：

- `gas/build/Code.js`
- Apps Script 編輯器中的線上程式碼

## 使用前準備

正式 Google Sheets 需要有這些工作表：

- `people`
- `settings`
- `itinerary`
- `contacts`

其中 `people` 欄位需與 `outputs/system_data.xlsx` 的 `people` 一致。

## 建立方式

1. 開啟正式 Google Sheets。
2. 點選 `擴充功能` -> `Apps Script`。
3. 確認 `gas/.clasp.json` 的 `scriptId` 是正式 Apps Script 專案 ID。
4. 執行 `npm.cmd run gas:push`。
5. 確認 Apps Script 後台已收到 `Code.js`。

## 部署方式

1. 點選 `部署` -> `新增部署作業`。
2. 類型選 `網頁應用程式`。
3. 執行身分選 `我`。
4. 存取權限先選 `知道連結的所有人`。
5. 部署後複製 Web App URL。

## 部署視窗反覆錯誤時

若在客戶的 Google Sheets 底下建立 Apps Script，但 `新增部署作業` 反覆出現錯誤，建議改用獨立 Apps Script：

1. 使用你的 Google 帳號開啟 `https://script.google.com/`。
2. 建立新專案。
3. 專案命名為 `畢旅查詢系統 API`。
4. 將新專案 ID 填入 `gas/.clasp.json`。
5. 執行 `npm.cmd run gas:push`。
6. 確認客戶 Google Sheets 已分享編輯權限給你的 Google 帳號。
7. 先執行 `setupProjectProperties` 與 `testReadPeople`，確認能讀到 `people` 工作表。
8. 再部署 Web App。

這種做法的資料仍在客戶 Google Sheets，GAS 只是由你的帳號部署與維護。

## API 端點

健康檢查：

```text
GET <WEB_APP_URL>?action=health
```

查詢已綁定資料：

```text
GET <WEB_APP_URL>?action=me&lineUserId=<LINE_USER_ID>
```

第一次驗證並綁定：

```json
{
  "action": "verifyAndBind",
  "name": "王小明",
  "studentId": "313001",
  "lineUserId": "Uxxxxxxxx"
}
```

老師第一次驗證並綁定：

```json
{
  "action": "verifyAndBind",
  "name": "王老師",
  "phoneLast3": "123",
  "lineUserId": "Uxxxxxxxx"
}
```

解除綁定：

```json
{
  "action": "unbind",
  "lineUserId": "Uxxxxxxxx"
}
```

## Apps Script 內建測試函式

部署前或部署後都可以在 Apps Script 編輯器直接執行：

- `setupProjectProperties`：初始化 Apps Script 專案屬性。
- `testHealth`：確認程式可執行。
- `testReadPeople`：確認可讀到 `people` 工作表。
- `testVerifyAndBindStudent`：用測試 LINE ID 綁定一位學生。
- `testUnbindTestUser`：解除測試 LINE ID 綁定。

重要 ID 請放在 Apps Script 專案屬性：

- `SPREADSHEET_ID`
- `PEOPLE_SHEET`
- `SETTINGS_SHEET`
- `API_KEY`

## 回傳資料

成功時會回傳：

```json
{
  "ok": true,
  "status": "BOUND",
  "profile": {
    "name": "王小明",
    "bus": "A車",
    "tableNo": "1桌",
    "roomNo": "尚未公告",
    "roomGroup": "男1",
    "roomMembers": "王小明、李小華",
    "vegetarian": "無"
  }
}
```

## 注意

- 學生使用姓名加學號驗證。
- 老師使用姓名加手機末三碼驗證。
- 身分證、生日、完整手機不應出現在 `people` 系統表。
- 若名單更新，重新產生 `outputs/system_data.xlsx` 後再更新 Google Sheets 的系統工作表。
