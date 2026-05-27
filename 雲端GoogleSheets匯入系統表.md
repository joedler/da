# 雲端 Google Sheets 匯入系統表

目前 GAS 錯誤：

```text
Error: 找不到工作表：people
```

代表 Apps Script 已經連到正式 Google Sheets，但雲端檔裡尚未建立系統用工作表。

## 需要匯入的檔案

CSV 已產出在：

- [people.csv](D:/_LINE BOT/_TRAVEL_APP/outputs/csv/people.csv)
- [settings.csv](D:/_LINE BOT/_TRAVEL_APP/outputs/csv/settings.csv)
- [itinerary.csv](D:/_LINE BOT/_TRAVEL_APP/outputs/csv/itinerary.csv)
- [contacts.csv](D:/_LINE BOT/_TRAVEL_APP/outputs/csv/contacts.csv)

## 匯入方式

請在正式 Google Sheets 內操作。

### 方式 A：匯入 CSV，建議使用

1. 開啟正式 Google Sheets。
2. 點選 `檔案`。
3. 點選 `匯入`。
4. 選擇 `上傳`。
5. 選擇 `outputs/csv/people.csv`。
6. 匯入位置選 `插入新工作表`。
7. 匯入後，把新工作表名稱改成 `people`。
8. 重複匯入：
   - `settings.csv`，工作表名稱改成 `settings`
   - `itinerary.csv`，工作表名稱改成 `itinerary`
   - `contacts.csv`，工作表名稱改成 `contacts`

### 方式 B：直接匯入 system_data.xlsx

也可以直接匯入：

[system_data.xlsx](D:/_LINE BOT/_TRAVEL_APP/outputs/system_data.xlsx)

但匯入時要確認四張工作表名稱仍為：

- `people`
- `settings`
- `itinerary`
- `contacts`

## 匯入後測試

回到 Apps Script。

1. 上方函式選單選 `testReadPeople`。
2. 點選 `執行`。
3. 正常應看到類似：

```json
{
  "ok": true,
  "rows": 188,
  "firstName": "謝旻淵"
}
```

看到這個結果後，才繼續部署 Web App。
