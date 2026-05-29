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
  busLeaderName: string;
  busLeaderPhone: string;
  busLeaderLine: string;
  roomNo: string;
  firstDayHotel: string;
  firstDayRoomNo: string;
  secondDayHotel: string;
  secondDayRoomNo: string;
  roomGroup: string;
  roomMembers: string;
  vegetarian: string;
}

interface ItineraryItem {
  day: string;
  date: string;
  weekday: string;
  time: string;
  title: string;
  note: string;
  hotel: string;
  hotelAddress: string;
  hotelPhone: string;
}

interface ApiResponse {
  ok: boolean;
  status?: string;
  error?: string;
  message?: string;
  profile?: ApiProfile;
  itinerary?: ItineraryItem[];
  [key: string]: unknown;
}

interface AppSettings {
  activityName: string;
  tableMealLabel: string;
  roomNumberStatus: string;
}

interface LineWebhookEvent {
  type?: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: {
    type?: string;
    text?: string;
  };
}

const CONFIG = {
  DEFAULT_SPREADSHEET_ID: "SET_IN_SCRIPT_PROPERTIES",
  DEFAULT_PEOPLE_SHEET: "people",
  DEFAULT_SETTINGS_SHEET: "settings",
  DEFAULT_ITINERARY_SHEET: "itinerary",
  DEFAULT_ROOM_ASSIGNMENTS_SHEET: "room_assignments",
  DEFAULT_CONTACTS_SHEET: "contacts",
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

    if (action === "settings") {
      return json_({
        ok: true,
        settings: getAppSettings_(),
      });
    }

    if (action === "itinerary") {
      return json_({
        ok: true,
        itinerary: getItinerary_(),
      });
    }

    if (action === "verifyAndBind") {
      return json_(verifyAndBind_({
        name: getParam_(e, "name"),
        studentId: getParam_(e, "studentId"),
        phoneLast3: getParam_(e, "phoneLast3"),
        lineUserId: getParam_(e, "lineUserId"),
      }));
    }

    if (action === "unbind") {
      return json_(unbind_({
        lineUserId: getParam_(e, "lineUserId"),
      }));
    }

    return json_({ ok: false, error: "UNKNOWN_ACTION" });
  } catch (error) {
    return jsonError_(error);
  }
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput | void {
  try {
    const body = parseBody_(e);
    if (isLineWebhook_(body)) {
      try {
        handleLineWebhook_(body);
      } catch (error) {
        Logger.log(`LINE webhook error: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }

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

function isLineWebhook_(body: ApiPayload): boolean {
  return Array.isArray(body.events);
}

function handleLineWebhook_(body: ApiPayload): void {
  const events = Array.isArray(body.events) ? body.events as LineWebhookEvent[] : [];
  Logger.log(`LINE webhook events: ${events.length}`);
  events.forEach((event) => {
    Logger.log(`LINE webhook event type: ${event.type || ""}`);
    if (!event.replyToken) return;

    if (event.type === "follow") {
      replyText_(event.replyToken, buildBotIntroMessage_());
      return;
    }

    if (event.message?.type !== "text") return;

    const userId = normalize_(event.source?.userId || "");

    // 查詢指令：輸入「查詢」或任意文字都觸發查詢
    const result = getMyInfo_(userId);
    if (!result.ok) {
      // 尚未綁定
      replyText_(event.replyToken, buildBotIntroMessage_());
      return;
    }

    const p = result.profile!;
    replyFlex_(event.replyToken, p);
  });
}

function buildBotIntroMessage_(): string {
  const liffUrl = getProperty_("LIFF_URL", "");
  const activityName = getProperty_("ACTIVITY_NAME", "本次團體旅遊");
  return [
    `您好，歡迎使用團旅小幫手。`,
    ``,
    `本帳號提供 ${activityName} 資訊查詢。`,
    `請開啟以下連結查詢車次、桌號、房間編組、同房人員與素食註記：`,
    liffUrl || "請點選下方圖文選單進入查詢頁。",
    ``,
    `本帳號為資訊查詢工具，若資料有誤或需人工協助，請聯繫領隊或承辦人員。`,
  ].join("\n");
}

function buildProfileFlex_(p: ApiProfile): Record<string, unknown> {
  const hasVegetarian = Boolean(p.vegetarian && p.vegetarian !== "無" && p.vegetarian !== "");

  const infoRow = (
    label: string,
    value: string,
    opts?: { wrap?: boolean; valueColor?: string; bold?: boolean }
  ): Record<string, unknown> => ({
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: label,
        color: "#888888",
        size: "sm",
        flex: 3,
      },
      {
        type: "text",
        text: value || "尚未公告",
        color: opts?.valueColor ?? (value ? "#222222" : "#AAAAAA"),
        size: "sm",
        flex: 4,
        align: "end",
        wrap: opts?.wrap ?? false,
        weight: opts?.bold ? "bold" : "regular",
      },
    ],
    paddingTop: "12px",
    paddingBottom: "12px",
    paddingStart: "16px",
    paddingEnd: "16px",
  });

  const sep: Record<string, unknown> = { type: "separator", color: "#F0F0F0" };

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "🎓 畢旅小幫手", color: "#ffffff99", size: "xs" },
        { type: "text", text: p.name, color: "#ffffff", size: "xxl", weight: "bold" },
        {
          type: "text",
          text: [p.roleClass, p.type].filter(Boolean).join("・"),
          color: "#ffffffbb",
          size: "sm",
        },
      ],
      paddingAll: "20px",
      paddingBottom: "24px",
      background: {
        type: "linearGradient",
        angle: "135deg",
        startColor: "#FF6B35",
        endColor: "#C0392B",
      },
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        infoRow("🚌 車次", p.bus),
        sep,
        infoRow("📞 領隊", [p.busLeaderName, p.busLeaderPhone].filter(Boolean).join(" "), { wrap: true }),
        sep,
        infoRow("🍽️ 桌號", p.tableNo),
        sep,
        infoRow("🏨 第一天房號", p.firstDayRoomNo || p.roomNo),
        sep,
        infoRow("🏨 第二天房號", p.secondDayRoomNo || p.roomNo),
        sep,
        infoRow("👥 同房人員", p.roomMembers, { wrap: true }),
        sep,
        hasVegetarian
          ? infoRow("🥗 素食", "✓ " + p.vegetarian, { valueColor: "#27AE60", bold: true })
          : infoRow("🥗 素食", "無", { valueColor: "#AAAAAA" }),
      ],
      paddingAll: "0px",
      spacing: "none",
    },
  };
}

function replyFlex_(replyToken: string, p: ApiProfile): void {
  const channelAccessToken = getProperty_("LINE_CHANNEL_ACCESS_TOKEN", "");
  if (!channelAccessToken) {
    Logger.log("LINE flex reply skipped: LINE_CHANNEL_ACCESS_TOKEN is empty.");
    return;
  }

  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${channelAccessToken}` },
    payload: JSON.stringify({
      replyToken,
      messages: [
        {
          type: "flex",
          altText: `${p.name} 的旅遊資訊`,
          contents: buildProfileFlex_(p),
        },
      ],
    }),
    muteHttpExceptions: true,
  });
  Logger.log(`LINE flex reply status: ${response.getResponseCode()}`);
  Logger.log(`LINE flex reply body: ${response.getContentText()}`);
}

function replyText_(replyToken: string, text: string): void {
  const channelAccessToken = getProperty_("LINE_CHANNEL_ACCESS_TOKEN", "");
  if (!channelAccessToken) {
    Logger.log("LINE reply skipped: LINE_CHANNEL_ACCESS_TOKEN is empty.");
    return;
  }

  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
    },
    payload: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
    muteHttpExceptions: true,
  });
  Logger.log(`LINE reply status: ${response.getResponseCode()}`);
  Logger.log(`LINE reply body: ${response.getContentText()}`);
}

function forceAuth(): void {
  UrlFetchApp.fetch("https://www.google.com");
  DriveApp.getRootFolder();
  SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  Logger.log("forceAuth 完成：外部連線 + Drive + Spreadsheet 授權已取得");
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

function testReadSettings(): void {
  Logger.log(JSON.stringify({
    ok: true,
    settings: getAppSettings_(),
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
  const roomGroup = read_(row, header, "房間編組");
  const roomAssignment = getRoomAssignment_(roomGroup);
  const legacyRoomNo = read_(row, header, "房號") || "尚未公告";
  const bus = read_(row, header, "車次");
  const busLeader = getBusLeader_(bus);

  return {
    personId: read_(row, header, "person_id"),
    type: read_(row, header, "類別"),
    name: read_(row, header, "姓名"),
    roleClass: read_(row, header, "班級或職稱"),
    bus,
    tableNo: read_(row, header, "桌號"),
    busLeaderName: busLeader.name,
    busLeaderPhone: busLeader.phone,
    busLeaderLine: busLeader.line,
    roomNo: legacyRoomNo,
    firstDayHotel: readOptional_(row, header, "第一天飯店") || roomAssignment.firstDayHotel,
    firstDayRoomNo: readOptional_(row, header, "第一天房號") || roomAssignment.firstDayRoomNo || legacyRoomNo,
    secondDayHotel: readOptional_(row, header, "第二天飯店") || roomAssignment.secondDayHotel,
    secondDayRoomNo: readOptional_(row, header, "第二天房號") || roomAssignment.secondDayRoomNo || legacyRoomNo,
    roomGroup,
    roomMembers: read_(row, header, "同房人員"),
    vegetarian: read_(row, header, "素食註記") || "無",
  };
}

function getBusLeader_(bus: string): { name: string; phone: string; line: string } {
  const empty = { name: "", phone: "", line: "" };
  if (!bus) return empty;

  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const sheetName = getProperty_("CONTACTS_SHEET", CONFIG.DEFAULT_CONTACTS_SHEET);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return empty;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return empty;

  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });

  const row = values.slice(1).find((item) => {
    const type = readOptional_(item, header, "類型");
    const serviceBus = readOptional_(item, header, "服務車次");
    return type === "旅行社領隊" && serviceBus === bus;
  });
  if (!row) return empty;

  return {
    name: readOptional_(row, header, "姓名"),
    phone: readOptional_(row, header, "電話"),
    line: readOptional_(row, header, "LINE或其他聯絡方式"),
  };
}

function getRoomAssignment_(roomGroup: string): {
  firstDayHotel: string;
  firstDayRoomNo: string;
  secondDayHotel: string;
  secondDayRoomNo: string;
} {
  const empty = {
    firstDayHotel: "",
    firstDayRoomNo: "",
    secondDayHotel: "",
    secondDayRoomNo: "",
  };
  if (!roomGroup) return empty;

  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const sheetName = getProperty_("ROOM_ASSIGNMENTS_SHEET", CONFIG.DEFAULT_ROOM_ASSIGNMENTS_SHEET);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return empty;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return empty;

  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });

  const row = values.slice(1).find((item) => readOptional_(item, header, "房間編組") === roomGroup);
  if (!row) return empty;

  return {
    firstDayHotel: readOptional_(row, header, "第一天飯店"),
    firstDayRoomNo: readOptional_(row, header, "第一天房號"),
    secondDayHotel: readOptional_(row, header, "第二天飯店"),
    secondDayRoomNo: readOptional_(row, header, "第二天房號"),
  };
}

function getPeopleSheet_(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const peopleSheetName = getProperty_("PEOPLE_SHEET", CONFIG.DEFAULT_PEOPLE_SHEET);
  const sheet = spreadsheet.getSheetByName(peopleSheetName);
  if (!sheet) throw new Error(`找不到工作表：${peopleSheetName}`);
  return sheet;
}

function getSettingsSheet_(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const settingsSheetName = getProperty_("SETTINGS_SHEET", CONFIG.DEFAULT_SETTINGS_SHEET);
  const sheet = spreadsheet.getSheetByName(settingsSheetName);
  if (!sheet) throw new Error(`找不到工作表：${settingsSheetName}`);
  return sheet;
}

function getItinerarySheet_(): GoogleAppsScript.Spreadsheet.Sheet | null {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const itinerarySheetName = getProperty_("ITINERARY_SHEET", CONFIG.DEFAULT_ITINERARY_SHEET);
  return spreadsheet.getSheetByName(itinerarySheetName);
}

function getItinerary_(): ItineraryItem[] {
  const sheet = getItinerarySheet_();
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });

  return values.slice(1)
    .filter((row) => readOptional_(row, header, "day") || readOptional_(row, header, "title"))
    .map((row) => ({
      day: readOptional_(row, header, "day"),
      date: readOptional_(row, header, "date"),
      weekday: readOptional_(row, header, "weekday"),
      time: readOptional_(row, header, "time"),
      title: readOptional_(row, header, "title"),
      note: readOptional_(row, header, "note"),
      hotel: readOptional_(row, header, "hotel"),
      hotelAddress: readOptional_(row, header, "hotel_address"),
      hotelPhone: readOptional_(row, header, "hotel_phone"),
    }));
}

function getAppSettings_(): AppSettings {
  const values = getSettingsSheet_().getDataRange().getValues();
  const settings: Record<string, string> = {};

  values.slice(1).forEach((row) => {
    const key = normalize_(row[0]);
    if (key) settings[key] = normalize_(row[1]);
  });

  return {
    activityName: settings.activity_name || "畢旅查詢系統",
    tableMealLabel: settings.table_meal_label || "指定餐次桌號",
    roomNumberStatus: settings.room_number_status || "尚未公告",
  };
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

function readOptional_(row: SheetRow, header: HeaderMap, name: string): string {
  if (header[name] === undefined) return "";
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
