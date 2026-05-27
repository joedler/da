# 畢業旅行查詢系統

本專案用於建立高中畢業旅行 LINE Bot / 網頁查詢系統。

## 目前階段

- 已確認原始名單 Excel 結構。
- 已建立需求草稿與資料檢查紀錄。
- 已建立資料轉換腳本，將原始 Excel 轉成系統用資料表。

## 資料轉換

輸入：

- `畢業旅行彙整名單_v5.xlsx`

輸出：

- `outputs/system_data.xlsx`

輸出工作表：

- `people`：查詢主資料
- `settings`：活動設定
- `itinerary`：行程表，待補
- `contacts`：領隊與聯絡窗口，待補

另可輸出 Google Sheets 方便匯入的 CSV：

```powershell
& 'C:\Users\Joe\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts/export_system_csv.mjs'
```

CSV 會輸出到：

- `outputs/csv/people.csv`
- `outputs/csv/settings.csv`
- `outputs/csv/itinerary.csv`
- `outputs/csv/contacts.csv`

執行方式：

```powershell
& 'C:\Users\Joe\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'scripts/convert_workbook.mjs'
```

## 查詢邏輯

- 學生第一次使用 `姓名 + 學號` 驗證。
- 老師第一次使用 `姓名 + 手機末三碼` 驗證。
- 系統表只保留學生學號與老師手機末三碼，不輸出身分證、生日或老師完整手機。
- 驗證成功後綁定 LINE ID。
- 之後再次開啟時自動顯示個人資料。

## 顯示欄位

- 我的車次
- 我的桌號
- 我的房號
- 我的房間編組
- 我的同房人員
- 素食註記
- 行程提醒

## Google Apps Script

API 原始碼在：

- `gas/src/Code.ts`

編譯輸出在：

- `gas/build/Code.js`

部署教學在：

- `下一步_GAS部署教學.md`

本專案採用 TypeScript + clasp 流程維護 GAS，不建議直接修改 Apps Script 編輯器中的程式。

常用指令：

```powershell
npm.cmd run gas:lint
npm.cmd run gas:build
npm.cmd run gas:check
npm.cmd run gas:push
```

流程：

1. 修改 `gas/src/Code.ts`。
2. 執行 `npm.cmd run gas:check`。
3. 執行 `npm.cmd run gas:push` 推送到 Apps Script。
4. 若 Web App 需要吃到新版本，到 Apps Script 後台更新部署版本。

開發環境與日後複製專案的備忘錄：

- `開發環境基礎建設懶人包.md`

內容包含：

- 全域工具與專案設定分工
- GAS 專案屬性管理
- TypeScript + clasp 流程
- Git / GitHub / GitHub Actions 建議
- GitHub Pages 前端架構
- Tailwind CSS CDN + Alpine.js 使用原則
- 新客戶複製 checklist

GitHub Pages 設定：

- `docs/index.html`
- `GitHubPages設定教學.md`

目前前端網址：

- `https://joedler.github.io/da/`

目前 LIFF URL：

- `https://liff.line.me/2010211676-aN5CpjP8`

目前 GAS Web App URL：

- `https://script.google.com/macros/s/AKfycbw73Uf4VxqJlJ_uAh7rAzWp8eWMHwIbCprBaysFxqSVQ4oCN1_Kf8BmtcrDARVBA8kN/exec`

前端會從 GAS `?action=settings` 讀取：

- `activity_name`
- `table_meal_label`
- `room_number_status`

因此客戶在 Google Sheets 的 `settings` 工作表更新活動名稱後，前端會自動顯示最新名稱。

客戶測試版文件：

- `客戶測試版交付清單.md`
- `客戶測試案例表.md`
- `客戶測試邀請文字.md`
- `客戶測試詳細說明.md`
