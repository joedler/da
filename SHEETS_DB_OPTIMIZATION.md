# Google Sheets 作為資料庫的極速調優黃金手冊 (SHEETS_DB_OPTIMIZATION.md)

在 LINE Bot、輕量網頁或中小企業的 Serverless 系統開發中，使用 **Google Sheets（試算表）** 作為資料庫（Database）是最快速、最直觀的選擇。

然而，90% 的開發者因為不了解 Google Sheets API 的物理存取限制與 GAS (Google Apps Script) 的運行特徵，寫出來的程式往往「慢如烏龜（每次讀取需 3~5 秒）」，且極易觸發 Google 每分鐘讀寫次數限制 (Quota) 與 6 分鐘執行時間上限。

本手冊為你總結 **「極速調優黃金 5 大法則」**，幫助你將 Google Sheets 資料庫的效能與防呆機制提升至企業級的頂尖水準！

---

## 🗺️ 系統效能全鏈路圍剿圖

在進入優化細節前，一個高效的 Sheets-DB 架構應該從「本機」➔「網路」➔「後端」進行全鏈路的效能防禦：

```
[ 手機端 LIFF ]
   │
   ├── (1) 0秒秒開 ──> 優先讀取 LocalStorage 快取 (體感速度直降 0 秒)
   │
   └── (2) 背景同步 ─> 合併 API 請求 (將多重連線減為 1 次)
         │
         ▼
[ Google Apps Script (GAS) ]
   │
   ├── (3) 0.2秒秒回 ─> CacheService 記憶體快取 (99% 的讀取不碰 Sheet)
   │
   └── (4) 0延遲比對 ─> In-Memory Hash Index 記憶體索引 (將搜尋時間降為 O(1))
         │
         ▼
[ Google Sheets 試算表 DB ]
   │
   └── (5) 物理提速 ──> 邊界裁剪與防呆驗證 (刪除空白行列，下拉選單鎖死格式)
```

---

## 🎯 第一法則：【防呆選單】— 用「資料驗證」充當 SQL 外鍵約束

* **痛點**：Google Sheets 屬於開放式單元格，人工輸入資料時，打錯字、錯用繁簡體、多打空白鍵（如 `多媒二 ` 與 `多媒二`）是導致程式 API 串接關聯失敗的頭號殺手。
* **優化手段**：
  在 Google Sheets 中，選取關鍵的「關聯欄位」（如車次、班級、類別、權限），點選 **「資料 > 資料驗證 > 新增規則」**，設定為 **「下拉選單」**。
* **效果**：
  **100% 杜絕因人工輸入空格或錯字導致的串接失靈**，從資料源頭保證資料的乾淨與規範化，相當於傳統資料庫的「外鍵約束 (Foreign Key Constraint)」與「資料型態限制 (Schema)」。

---

## 🎯 第二法則：【物理裁剪】— 砍掉多餘空白行，實體讀取提速 30%

* **痛點**：Google Sheets 預設會保留 1000 行空白 Row 與數十列空白 Column。當 GAS 呼叫 `getDataRange().getValues()` 時，Google 實體 API 在背後會連同這幾千個空的 Cell 一併載入並進行 JSON 序列化傳輸，白白消耗實體磁碟讀寫與傳輸時間。
* **優化手段**：
  手動將工作表中所有**「沒有用到的空白行 (Row) 與空白列 (Column) 全部刪除」**。例如你的學員名單有 300 人，就只留下 320 行（多留 20 行備用即可）。
* **效果**：
  大幅縮減試算表實體檔案的體積，讓 Google API 的實體讀寫速度直接提升 **30% ~ 50%**。

---

## 🎯 第三法則：【批次存取】— 嚴禁在 Loop 迴圈內呼叫 Sheets API

* **痛點**：**這是 GAS 開發中最致命、最容易讓程式卡死並觸發 6 分鐘超時中斷的毒瘤！** 許多開發者會在 `for` 迴圈中不斷呼叫讀寫 API：
  ```javascript
  // ❌ 致命的慢速寫法：每跑一次迴圈就跟 Google 伺服器打一次網路請求 (RTT)
  for (let i = 0; i < rows.length; i++) {
    const value = sheet.getRange(i + 1, 1).getValue(); // 🐢 慢！
    if (value === "xxx") {
      sheet.getRange(i + 1, 2).setValue("ooo"); // 🐢 慢！
    }
  }
  ```
* **優化手段（一次讀取，批次寫入）**：
  * **讀取**：用 `sheet.getDataRange().getValues()` **一次性**將整張工作表讀入 JavaScript 記憶體陣列（只消耗 1 次網路來回）。
  * **寫入**：在 JS 記憶體中處理完二維陣列後，使用 `setValues(twoDimensionalArray)` **一次性批次寫回**。
  ```javascript
  // ⚡ 極速的批次寫法：僅消耗 1 次讀取與 1 次寫入 RTT
  const range = sheet.getDataRange();
  const values = range.getValues(); // 1 次讀取
  
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === "xxx") {
      values[i][1] = "ooo"; // 在記憶體中修改陣列
    }
  }
  range.setValues(values); // 1 次寫入，秒殺完成！
  ```

---

## 🎯 第四法則：【記憶體索引】— 建立 Hash Map 索引，將搜尋時間降為 $O(1)$

* **痛點**：在 JavaScript 中，對數百人名單進行頻繁的線性掃描（`rows.find()`）或雙重迴圈比對，時間複雜度是 $O(N)$。隨著人數增加，執行時間會呈指數上升。
* **優化手段**：
  一次性讀入資料後，立刻以 Primary Key（如 LINE ID、手機號、學號）在記憶體中建立 **哈希字典物件 (Hash Map / Record)**，後續查詢改為常數時間直出。

### 💻 實戰代碼 Before vs After：

#### 🐢 優化前 (線性掃描)：
```typescript
function getMyInfo_(lineUserId: string): ApiResponse {
  const normalizedLineUserId = normalize_(lineUserId);
  const table = readTable_(getPeopleSheet_());
  
  // 🐢 線性掃描：每次都要從第一列掃描到最後一列，時間複雜度 O(N)
  const person = table.rows.find((row) => read_(row, table.header, "LINE使用者ID") === normalizedLineUserId);

  if (!person) return { ok: false, error: "NOT_BOUND" };
  return { ok: true, profile: buildProfile_(person, table.header) };
}
```

#### ⚡ 優化後 (記憶體哈希索引)：
```typescript
function getMyInfo_(lineUserId: string): ApiResponse {
  const normalizedLineUserId = normalize_(lineUserId);
  const table = readTable_(getPeopleSheet_());
  
  // ⚡ 建立快速雜湊索引：僅在加載時遍歷一次，時間複雜度 O(N)
  const lineUserIndex: Record<string, SheetRow> = {};
  table.rows.forEach((row) => {
    const uid = read_(row, table.header, "LINE使用者ID");
    if (uid) lineUserIndex[uid] = row;
  });

  // ⚡ 查詢：直接以 Key 存取字典，時間複雜度直降為物理極限的 O(1)！
  const person = lineUserIndex[normalizedLineUserId];

  if (!person) return { ok: false, error: "NOT_BOUND" };
  return { ok: true, profile: buildProfile_(person, table.header) };
}
```

---

## 🎯 第五法則：【快取緩衝】— 引入 `CacheService` 實作資料庫緩衝層

* **痛點**：像行程表、相簿連結、設定檔等資料，屬於「高頻讀取、低頻寫入」。如果每次 API 呼叫都去開啟並讀取實體 Sheets，會耗費大量的 API Quota，且每次開網頁都要等待 1.5 秒以上。
* **優化手段**：
  利用 GAS 的 **`CacheService.getScriptCache()`** 實作資料庫的快取快照，快取期限設為 5~10 分鐘，並使用 `try...catch` 包裹以確保在快取異常時能自動安全降級回讀取 Sheet。

### 💻 實戰代碼範例：

```typescript
function getInitData_(): ApiResponse {
  const cache = CacheService.getScriptCache();
  const cacheKey = "initData_v1";
  
  // 1. 嘗試從記憶體快取中讀取 (0.2 秒秒回)
  try {
    const cached = cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ApiResponse;
    }
  } catch (err) {
    Logger.log("讀取 initData 快取失敗: " + err);
  }

  // 2. 快取未命中：讀取 Google Sheets 資料庫 (耗時 1.5 秒)
  const data: ApiResponse = {
    ok: true,
    settings: getAppSettings_(),
    itinerary: getItinerary_(),
    albums: handleAlbums_().albums || [],
  };

  // 3. 將資料寫入記憶體快取，保存 10 分鐘 (600 秒)
  try {
    cache.put(cacheKey, JSON.stringify(data), 600);
  } catch (err) {
    Logger.log("寫入 initData 快取失敗: " + err);
  }

  return data;
}
```

---

## 🏁 結論

將 Google Sheets 作為輕量資料庫時，只要僅守這 **「黃金 5 大法則」**：
1. **下拉選單鎖死欄位格式**（杜絕錯字）
2. **物理刪除多餘空白行**（加快實體讀取）
3. **Loop 迴圈內絕不讀寫 API**（改用批次讀寫）
4. **記憶體建立雜湊字典索引**（將查詢降為 $O(1)$）
5. **引入 `CacheService` 緩衝層**（阻絕 Sheet 讀取）

你就能用最簡單的架構，打造出**速度極快、防呆能力極強、且無懼高併發流量**的企業級優秀 Serverless 系統！
