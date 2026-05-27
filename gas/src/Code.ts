type ApiPayload = Record<string, unknown>;
type SheetRow = unknown[];
type HeaderMap = Record<string, number>;

interface PeopleTable {
  values: SheetRow[];
  header: HeaderMap;
  rows: SheetRow[];
}

interface ApiProfile {
  personId: string;
  type: string;
  name: string;
  roleClass: string;
  bus: string;
  tableNo: string;
  roomNo: string;
  roomGroup: string;
  roomMembers: string;
  vegetarian: string;
}

interface ApiResponse {
  ok: boolean;
  status?: string;
  error?: string;
  message?: string;
  profile?: ApiProfile;
  [key: string]: unknown;
}

const CONFIG = {
  DEFAULT_SPREADSHEET_ID: "SET_IN_SCRIPT_PROPERTIES",
  DEFAULT_PEOPLE_SHEET: "people",
  DEFAULT_SETTINGS_SHEET: "settings",
  DEFAULT_API_KEY: "dev-change-me",
} as const;

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  const action = getParam_(e, "action") || "health";

  try {
    if (action === "health") {
      return json_({
        ok: true,
        service: "grad-trip-api",
        timestamp: new Date().toISOString(),
      });
    }

    if (action === "me") {
      const lineUserId = getParam_(e, "lineUserId");
      return json_(getMyInfo_(lineUserId));
    }

    return json_({ ok: false, error: "UNKNOWN_ACTION" });
  } catch (error) {
    return jsonError_(error);
  }
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const body = parseBody_(e);
    const action = normalize_(body.action);

    if (action === "verifyAndBind") {
      return json_(verifyAndBind_(body));
    }

    if (action === "unbind") {
      return json_(unbind_(body));
    }

    return json_({ ok: false, error: "UNKNOWN_ACTION" });
  } catch (error) {
    return jsonError_(error);
  }
}

function testHealth(): void {
  Logger.log(JSON.stringify({
    ok: true,
    service: "grad-trip-api",
    spreadsheetId: getRequiredProperty_("SPREADSHEET_ID"),
    timestamp: new Date().toISOString(),
  }, null, 2));
}

function setupProjectProperties(): void {
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: CONFIG.DEFAULT_SPREADSHEET_ID,
    PEOPLE_SHEET: CONFIG.DEFAULT_PEOPLE_SHEET,
    SETTINGS_SHEET: CONFIG.DEFAULT_SETTINGS_SHEET,
    API_KEY: CONFIG.DEFAULT_API_KEY,
  }, false);

  Logger.log(JSON.stringify({
    ok: true,
    message: "Project properties initialized.",
    properties: getSafeProjectProperties_(),
  }, null, 2));
}

function testReadPeople(): void {
  const table = readTable_(getPeopleSheet_());
  Logger.log(JSON.stringify({
    ok: true,
    rows: table.rows.length,
    firstName: table.rows.length ? read_(table.rows[0], table.header, "姓名") : "",
  }, null, 2));
}

function testVerifyAndBindStudent(): void {
  const name = getRequiredProperty_("TEST_STUDENT_NAME");
  const studentId = getRequiredProperty_("TEST_STUDENT_ID");

  const result = verifyAndBind_({
    name,
    studentId,
    lineUserId: "TEST_USER_001",
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function testUnbindTestUser(): void {
  const result = unbind_({
    lineUserId: "TEST_USER_001",
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function verifyAndBind_(body: ApiPayload): ApiResponse {
  const name = normalize_(body.name);
  const studentId = normalize_(body.studentId);
  const phoneLast3 = normalize_(body.phoneLast3);
  const lineUserId = normalize_(body.lineUserId);

  require_(name, "姓名必填");
  require_(lineUserId, "LINE 使用者 ID 必填");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getPeopleSheet_();
    const table = readTable_(sheet);
    const { header, rows } = table;

    const existingBound = rows.find((row) => read_(row, header, "LINE使用者ID") === lineUserId);
    if (existingBound) {
      return {
        ok: true,
        status: "ALREADY_BOUND",
        profile: buildProfile_(existingBound, header),
      };
    }

    const candidates = rows.filter((row) => read_(row, header, "姓名") === name);
    if (candidates.length === 0) {
      return { ok: false, error: "PERSON_NOT_FOUND", message: "查無此姓名，請確認輸入是否正確。" };
    }

    const matched = candidates.filter((row) => {
      const type = read_(row, header, "類別");
      if (type === "學生") {
        return Boolean(studentId) && read_(row, header, "學號") === studentId;
      }
      if (type === "老師") {
        return Boolean(phoneLast3) && read_(row, header, "手機末三碼") === phoneLast3;
      }
      return false;
    });

    if (matched.length === 0) {
      return { ok: false, error: "VERIFY_FAILED", message: "驗證資料不符合，請確認姓名與學號或手機末三碼。" };
    }

    if (matched.length > 1) {
      return { ok: false, error: "DUPLICATE_MATCH", message: "符合資料超過一筆，請聯絡管理者確認名單。" };
    }

    const person = matched[0];
    const rowIndex = rows.indexOf(person) + 2;
    const boundLineUserId = read_(person, header, "LINE使用者ID");

    if (boundLineUserId && boundLineUserId !== lineUserId) {
      return { ok: false, error: "PERSON_ALREADY_BOUND", message: "此資料已綁定其他 LINE 帳號，請聯絡管理者解除綁定。" };
    }

    sheet.getRange(rowIndex, header["LINE使用者ID"] + 1).setValue(lineUserId);
    sheet.getRange(rowIndex, header["綁定時間"] + 1).setValue(new Date());

    const updated = sheet.getRange(rowIndex, 1, 1, table.values[0].length).getValues()[0];
    return {
      ok: true,
      status: "BOUND",
      profile: buildProfile_(updated, header),
    };
  } finally {
    lock.releaseLock();
  }
}

function getMyInfo_(lineUserId: string): ApiResponse {
  const normalizedLineUserId = normalize_(lineUserId);
  require_(normalizedLineUserId, "LINE 使用者 ID 必填");

  const table = readTable_(getPeopleSheet_());
  const person = table.rows.find((row) => read_(row, table.header, "LINE使用者ID") === normalizedLineUserId);

  if (!person) {
    return { ok: false, error: "NOT_BOUND", message: "尚未完成首次驗證與綁定。" };
  }

  return {
    ok: true,
    status: "BOUND",
    profile: buildProfile_(person, table.header),
  };
}

function unbind_(body: ApiPayload): ApiResponse {
  const lineUserId = normalize_(body.lineUserId);
  require_(lineUserId, "LINE 使用者 ID 必填");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getPeopleSheet_();
    const table = readTable_(sheet);
    const rowIndex = table.rows.findIndex((row) => read_(row, table.header, "LINE使用者ID") === lineUserId);

    if (rowIndex < 0) {
      return { ok: false, error: "NOT_BOUND", message: "此 LINE 帳號目前沒有綁定資料。" };
    }

    sheet.getRange(rowIndex + 2, table.header["LINE使用者ID"] + 1).setValue("");
    sheet.getRange(rowIndex + 2, table.header["綁定時間"] + 1).setValue("");
    return { ok: true, status: "UNBOUND" };
  } finally {
    lock.releaseLock();
  }
}

function buildProfile_(row: SheetRow, header: HeaderMap): ApiProfile {
  return {
    personId: read_(row, header, "person_id"),
    type: read_(row, header, "類別"),
    name: read_(row, header, "姓名"),
    roleClass: read_(row, header, "班級或職稱"),
    bus: read_(row, header, "車次"),
    tableNo: read_(row, header, "桌號"),
    roomNo: read_(row, header, "房號") || "尚未公告",
    roomGroup: read_(row, header, "房間編組"),
    roomMembers: read_(row, header, "同房人員"),
    vegetarian: read_(row, header, "素食註記") || "無",
  };
}

function getPeopleSheet_(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const peopleSheetName = getProperty_("PEOPLE_SHEET", CONFIG.DEFAULT_PEOPLE_SHEET);
  const sheet = spreadsheet.getSheetByName(peopleSheetName);
  if (!sheet) throw new Error(`找不到工作表：${peopleSheetName}`);
  return sheet;
}

function readTable_(sheet: GoogleAppsScript.Spreadsheet.Sheet): PeopleTable {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error("people 工作表沒有資料");

  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });

  const required = [
    "person_id",
    "類別",
    "姓名",
    "學號",
    "手機末三碼",
    "LINE使用者ID",
    "綁定時間",
    "車次",
    "桌號",
    "房號",
    "房間編組",
    "同房人員",
    "素食註記",
  ];

  required.forEach((name) => {
    if (header[name] === undefined) throw new Error(`people 缺少欄位：${name}`);
  });

  return {
    values,
    header,
    rows: values.slice(1).filter((row) => read_(row, header, "姓名")),
  };
}

function parseBody_(e: GoogleAppsScript.Events.DoPost): ApiPayload {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents) as ApiPayload;
}

function getParam_(e: GoogleAppsScript.Events.DoGet, name: string): string {
  return e && e.parameter ? normalize_(e.parameter[name]) : "";
}

function read_(row: SheetRow, header: HeaderMap, name: string): string {
  return normalize_(row[header[name]]);
}

function normalize_(value: unknown): string {
  return String(value === null || value === undefined ? "" : value).trim();
}

function require_(value: unknown, message: string): void {
  if (!normalize_(value)) throw new Error(message);
}

function getProperty_(key: string, fallback = ""): string {
  return normalize_(PropertiesService.getScriptProperties().getProperty(key)) || fallback;
}

function getRequiredProperty_(key: string): string {
  const value = getProperty_(key);
  if (!value) throw new Error(`缺少 Apps Script 專案屬性：${key}`);
  return value;
}

function getSafeProjectProperties_(): ApiPayload {
  const properties = PropertiesService.getScriptProperties().getProperties();
  return {
    SPREADSHEET_ID: properties.SPREADSHEET_ID || "",
    PEOPLE_SHEET: properties.PEOPLE_SHEET || "",
    SETTINGS_SHEET: properties.SETTINGS_SHEET || "",
    API_KEY: properties.API_KEY ? "[SET]" : "",
  };
}

function json_(payload: ApiResponse | ApiPayload): GoogleAppsScript.Content.TextOutput {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(error: unknown): GoogleAppsScript.Content.TextOutput {
  const message = error instanceof Error ? error.message : String(error);
  return json_({
    ok: false,
    error: "SERVER_ERROR",
    message,
  });
}
