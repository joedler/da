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
  contacts: ApiContact[];
  roomNo: string;
  firstDayHotel: string;
  firstDayRoomNo: string;
  secondDayHotel: string;
  secondDayRoomNo: string;
  roomGroup: string;
  roomMembers: string;
  vegetarian: string;
}

interface ApiContact {
  type: string;
  name: string;
  serviceBus: string;
  phone: string;
  line: string;
  note: string;
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

interface AdminUser {
  name: string;
  role: string;
  phoneLast3: string;
  lineUserId: string;
  permission: string;
  serviceBus: string;
  note: string;
}

interface OverviewPerson {
  name: string;
  type: string;
  roleClass: string;
  bus: string;
  tableNo: string;
  roomGroup: string;
  roomMembers: string;
  vegetarian: string;
  firstDayRoomNo: string;
  secondDayRoomNo: string;
  bound: boolean;
}

interface OverviewData {
  admin: AdminUser;
  stats: Record<string, unknown>;
  people: OverviewPerson[];
  contacts: ApiContact[];
}

interface ApiResponse {
  ok: boolean;
  status?: string;
  error?: string;
  message?: string;
  profile?: ApiProfile;
  itinerary?: ItineraryItem[];
  overview?: OverviewData;
  admin?: AdminUser;
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
  DEFAULT_ADMINS_SHEET: "admins",
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

    if (action === "adminMe") {
      return json_(getAdminMe_(getParam_(e, "lineUserId")));
    }

    if (action === "verifyAdmin") {
      return json_(verifyAdmin_({
        name: getParam_(e, "name"),
        phoneLast3: getParam_(e, "phoneLast3"),
        lineUserId: getParam_(e, "lineUserId"),
      }));
    }

    if (action === "overview") {
      return json_(getOverview_(getParam_(e, "lineUserId")));
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

    if (action === "verifyAdmin") {
      return json_(verifyAdmin_(body));
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
    const text = normalize_(event.message.text).toLowerCase();

    if (isOverviewCommand_(text)) {
      const admin = getAuthorizedAdmin_(userId);
      if (admin) {
        replyFlexMessage_(event.replyToken, "領隊總覽", buildLinkFlex_({
          title: "領隊總覽",
          subtitle: "查看分車、班級、房號、桌次與聯絡資訊",
          body: `${admin.name} ${admin.role || ""}`.trim(),
          buttonLabel: "開啟總覽",
          uri: buildLiffUrl_("overview"),
          accentColor: "#0F766E",
        }));
      } else {
        replyText_(event.replyToken, "此功能限領隊或管理者使用。若你是工作人員，請開啟領隊總覽並完成首次授權。");
      }
      return;
    }

    if (isItineraryCommand_(text)) {
      replyFlexMessage_(event.replyToken, "行程表", buildLinkFlex_({
        title: "行程表",
        subtitle: "三天兩夜時間軸",
        body: "查看每日集合、景點、用餐與住宿安排。",
        buttonLabel: "開啟行程表",
        uri: buildLiffUrl_("itinerary"),
        accentColor: "#1D4ED8",
      }));
      return;
    }

    if (isContactsCommand_(text)) {
      replyFlexMessage_(event.replyToken, "聯絡資訊", buildLinkFlex_({
        title: "聯絡資訊",
        subtitle: "領隊、班導、護理師與旅行社窗口",
        body: "開啟後會依你的車次顯示相關聯絡窗口。",
        buttonLabel: "開啟聯絡資訊",
        uri: buildLiffUrl_("contacts"),
        accentColor: "#7C3AED",
      }));
      return;
    }

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

function isOverviewCommand_(text: string): boolean {
  return ["總覽", "管理", "overview", "admin"].some((keyword) => text.includes(keyword));
}

function isItineraryCommand_(text: string): boolean {
  return ["行程", "行程表", "itinerary", "schedule"].some((keyword) => text.includes(keyword));
}

function isContactsCommand_(text: string): boolean {
  return ["聯絡", "連絡", "電話", "窗口", "contacts", "contact"].some((keyword) => text.includes(keyword));
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

function buildLiffUrl_(view: string): string {
  const liffUrl = getProperty_("LIFF_URL", "");
  if (!liffUrl) return "";
  return `${liffUrl}${liffUrl.includes("?") ? "&" : "?"}view=${encodeURIComponent(view)}`;
}

function buildLinkFlex_(options: {
  title: string;
  subtitle: string;
  body: string;
  buttonLabel: string;
  uri: string;
  accentColor: string;
}): Record<string, unknown> {
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      backgroundColor: options.accentColor,
      contents: [
        { type: "text", text: "團旅小幫手", color: "#ffffffcc", size: "xs", weight: "bold" },
        { type: "text", text: options.title, color: "#ffffff", size: "xxl", weight: "bold", margin: "md" },
        { type: "text", text: options.subtitle, color: "#ffffffcc", size: "sm", wrap: true, margin: "sm" },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "20px",
      contents: [
        { type: "text", text: options.body, color: "#334155", size: "sm", wrap: true },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "16px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: options.accentColor,
          action: {
            type: "uri",
            label: options.buttonLabel,
            uri: options.uri,
          },
        },
      ],
    },
  };
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
        flex: 4,
      },
      {
        type: "text",
        text: value || "尚未公告",
        color: opts?.valueColor ?? (value ? "#222222" : "#AAAAAA"),
        size: "sm",
        flex: 5,
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

  const sep: Record<string, unknown> = { type: "separator", color: "#E2E8F0" };
  const roleText = p.roleClass || p.type || "旅客";

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        { type: "text", text: "團旅小幫手", color: "#ffffffcc", size: "xs", weight: "bold" },
        { type: "text", text: p.name, color: "#ffffff", size: "xxl", weight: "bold", margin: "md" },
        {
          type: "text",
          text: [roleText, p.bus].filter(Boolean).join("｜"),
          color: "#ffffffcc",
          size: "sm",
          margin: "sm",
        },
      ],
      paddingAll: "20px",
      paddingBottom: "24px",
      backgroundColor: "#0F766E",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        infoRow("車次", p.bus, { bold: true }),
        sep,
        infoRow("領隊", [p.busLeaderName, p.busLeaderPhone].filter(Boolean).join(" "), { wrap: true }),
        sep,
        infoRow("桌號", p.tableNo),
        sep,
        infoRow("第一天房號", p.firstDayRoomNo || p.roomNo),
        sep,
        infoRow("第二天房號", p.secondDayRoomNo || p.roomNo),
        sep,
        infoRow("同房人員", p.roomMembers, { wrap: true }),
        sep,
        hasVegetarian
          ? infoRow("素食", p.vegetarian, { valueColor: "#047857", bold: true })
          : infoRow("素食", "無", { valueColor: "#94A3B8" }),
      ],
      paddingAll: "0px",
      spacing: "none",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#0F766E",
          action: { type: "uri", label: "我的資訊", uri: buildLiffUrl_("info") },
        },
        {
          type: "button",
          style: "secondary",
          action: { type: "uri", label: "行程表", uri: buildLiffUrl_("itinerary") },
        },
      ],
    },
  };
}

function replyFlexMessage_(replyToken: string, altText: string, contents: Record<string, unknown>): void {
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
          altText,
          contents,
        },
      ],
    }),
    muteHttpExceptions: true,
  });
  Logger.log(`LINE flex reply status: ${response.getResponseCode()}`);
  Logger.log(`LINE flex reply body: ${response.getContentText()}`);
}

function replyFlex_(replyToken: string, p: ApiProfile): void {
  replyFlexMessage_(replyToken, `${p.name} 的旅遊資訊`, buildProfileFlex_(p));
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

function verifyAdmin_(body: ApiPayload): ApiResponse {
  const name = normalize_(body.name);
  const phoneLast3 = normalize_(body.phoneLast3);
  const lineUserId = normalize_(body.lineUserId);

  require_(name, "姓名必填");
  require_(phoneLast3, "手機末三碼必填");
  require_(lineUserId, "LINE 使用者 ID 必填");

  const sheet = getAdminsSheet_();
  if (!sheet) return { ok: false, error: "ADMINS_NOT_FOUND", message: "尚未建立 admins 權限表。" };

  const table = readSimpleTable_(sheet);
  const rowIndex = table.rows.findIndex((row) =>
    readOptional_(row, table.header, "姓名") === name &&
    readOptional_(row, table.header, "手機末三碼") === phoneLast3
  );

  if (rowIndex < 0) {
    return { ok: false, error: "ADMIN_VERIFY_FAILED", message: "管理者驗證失敗，請確認姓名與手機末三碼。" };
  }

  const row = table.rows[rowIndex];
  const existingLineUserId = readOptional_(row, table.header, "LINE使用者ID");
  if (existingLineUserId && existingLineUserId !== lineUserId) {
    return { ok: false, error: "ADMIN_ALREADY_BOUND", message: "此管理者資料已綁定其他 LINE 帳號。" };
  }

  if (table.header["LINE使用者ID"] === undefined) {
    return { ok: false, error: "ADMINS_MISSING_FIELD", message: "admins 缺少 LINE使用者ID 欄位。" };
  }

  sheet.getRange(rowIndex + 2, table.header["LINE使用者ID"] + 1).setValue(lineUserId);
  const updated = sheet.getRange(rowIndex + 2, 1, 1, table.values[0].length).getValues()[0];
  return {
    ok: true,
    status: "ADMIN_BOUND",
    admin: buildAdmin_(updated, table.header),
  };
}

function getAdminMe_(lineUserId: string): ApiResponse {
  const admin = getAuthorizedAdmin_(lineUserId);
  if (!admin) return { ok: false, error: "NOT_ADMIN", message: "此 LINE 帳號尚未取得領隊總覽權限。" };
  return { ok: true, status: "ADMIN_BOUND", admin };
}

function getOverview_(lineUserId: string): ApiResponse {
  const admin = getAuthorizedAdmin_(lineUserId);
  if (!admin) return { ok: false, error: "NOT_ADMIN", message: "此頁面限領隊或管理者使用。" };

  const peopleTable = readTable_(getPeopleSheet_());
  const roomAssignments = getRoomAssignmentMap_();
  const people = peopleTable.rows.map((row) => buildOverviewPerson_(row, peopleTable.header, roomAssignments));
  const visiblePeople = admin.serviceBus
    ? people.filter((person) => person.bus === admin.serviceBus || person.type === "老師")
    : people;

  return {
    ok: true,
    overview: {
      admin,
      stats: buildOverviewStats_(visiblePeople),
      people: visiblePeople,
      contacts: getContactsForBus_(admin.serviceBus),
    },
  };
}

function buildProfile_(row: SheetRow, header: HeaderMap): ApiProfile {
  const roomGroup = read_(row, header, "房間編組");
  const roomAssignment = getRoomAssignment_(roomGroup);
  const legacyRoomNo = read_(row, header, "房號") || "尚未公告";
  const bus = read_(row, header, "車次");
  const contacts = getContactsForBus_(bus);
  const busLeader = contacts.find((item) => item.type === "旅行社領隊");

  return {
    personId: read_(row, header, "person_id"),
    type: read_(row, header, "類別"),
    name: read_(row, header, "姓名"),
    roleClass: readRoleClass_(row, header),
    bus,
    tableNo: read_(row, header, "桌號"),
    busLeaderName: busLeader?.name || "",
    busLeaderPhone: busLeader?.phone || "",
    busLeaderLine: busLeader?.line || "",
    contacts,
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

function buildOverviewPerson_(
  row: SheetRow,
  header: HeaderMap,
  roomAssignments: Record<string, {
    firstDayHotel: string;
    firstDayRoomNo: string;
    secondDayHotel: string;
    secondDayRoomNo: string;
  }>
): OverviewPerson {
  const roomGroup = read_(row, header, "房間編組");
  const assignment = roomAssignments[roomGroup];
  const legacyRoomNo = read_(row, header, "房號") || "尚未公告";
  return {
    name: read_(row, header, "姓名"),
    type: read_(row, header, "類別"),
    roleClass: readRoleClass_(row, header),
    bus: read_(row, header, "車次"),
    tableNo: read_(row, header, "桌號"),
    roomGroup,
    roomMembers: read_(row, header, "同房人員"),
    vegetarian: read_(row, header, "素食註記") || "",
    firstDayRoomNo: readOptional_(row, header, "第一天房號") || assignment?.firstDayRoomNo || legacyRoomNo,
    secondDayRoomNo: readOptional_(row, header, "第二天房號") || assignment?.secondDayRoomNo || legacyRoomNo,
    bound: Boolean(read_(row, header, "LINE使用者ID")),
  };
}

function readRoleClass_(row: SheetRow, header: HeaderMap): string {
  return readOptional_(row, header, "班級或職稱") ||
    readOptional_(row, header, "職稱/班級") ||
    readOptional_(row, header, "班級") ||
    readOptional_(row, header, "職稱") ||
    readOptional_(row, header, "備註");
}

function buildOverviewStats_(people: OverviewPerson[]): Record<string, unknown> {
  const busCounts: Record<string, number> = {};
  people.forEach((person) => {
    if (person.bus) busCounts[person.bus] = (busCounts[person.bus] || 0) + 1;
  });

  return {
    total: people.length,
    students: people.filter((person) => person.type === "學生").length,
    teachers: people.filter((person) => person.type === "老師").length,
    vegetarian: people.filter((person) => Boolean(person.vegetarian)).length,
    unbound: people.filter((person) => !person.bound).length,
    busCounts,
  };
}

function getContactsForBus_(bus: string): ApiContact[] {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const sheetName = getProperty_("CONTACTS_SHEET", CONFIG.DEFAULT_CONTACTS_SHEET);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return [];

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });

  return values.slice(1)
    .map((row) => ({
      type: readOptional_(row, header, "類型"),
      name: readOptional_(row, header, "姓名"),
      serviceBus: readOptional_(row, header, "服務車次"),
      phone: readOptional_(row, header, "電話"),
      line: readOptional_(row, header, "LINE或其他聯絡方式"),
      note: readOptional_(row, header, "備註"),
    }))
    .filter((item) => item.type && item.name)
    .filter((item) => {
      if (["護理師", "旅行社窗口"].includes(item.type)) return true;
      if (!bus) return true;
      return item.serviceBus === bus;
    });
}

function getAuthorizedAdmin_(lineUserId: string): AdminUser | null {
  const normalizedLineUserId = normalize_(lineUserId);
  if (!normalizedLineUserId) return null;

  const sheet = getAdminsSheet_();
  if (!sheet) return null;

  const table = readSimpleTable_(sheet);
  const row = table.rows.find((item) => readOptional_(item, table.header, "LINE使用者ID") === normalizedLineUserId);
  if (!row) return null;

  const admin = buildAdmin_(row, table.header);
  if (!hasOverviewPermission_(admin)) return null;
  return admin;
}

function buildAdmin_(row: SheetRow, header: HeaderMap): AdminUser {
  return {
    name: readOptional_(row, header, "姓名"),
    role: readOptional_(row, header, "角色"),
    phoneLast3: readOptional_(row, header, "手機末三碼"),
    lineUserId: readOptional_(row, header, "LINE使用者ID"),
    permission: readOptional_(row, header, "權限"),
    serviceBus: readOptional_(row, header, "服務車次"),
    note: readOptional_(row, header, "備註"),
  };
}

function hasOverviewPermission_(admin: AdminUser): boolean {
  const permission = admin.permission.toLowerCase();
  return permission.includes("overview") || permission.includes("admin") || permission.includes("all");
}

function getAdminsSheet_(): GoogleAppsScript.Spreadsheet.Sheet | null {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const sheetName = getProperty_("ADMINS_SHEET", CONFIG.DEFAULT_ADMINS_SHEET);
  return spreadsheet.getSheetByName(sheetName);
}

function readSimpleTable_(sheet: GoogleAppsScript.Spreadsheet.Sheet): PeopleTable {
  const values = sheet.getDataRange().getValues();
  const headerRow = values[0].map(normalize_);
  const header: HeaderMap = {};
  headerRow.forEach((name, index) => {
    if (name) header[name] = index;
  });
  return {
    values,
    header,
    rows: values.slice(1).filter((row) => row.some((cell) => normalize_(cell))),
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

function getRoomAssignmentMap_(): Record<string, {
  firstDayHotel: string;
  firstDayRoomNo: string;
  secondDayHotel: string;
  secondDayRoomNo: string;
}> {
  const spreadsheet = SpreadsheetApp.openById(getRequiredProperty_("SPREADSHEET_ID"));
  const sheetName = getProperty_("ROOM_ASSIGNMENTS_SHEET", CONFIG.DEFAULT_ROOM_ASSIGNMENTS_SHEET);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return {};

  const table = readSimpleTable_(sheet);
  const map: Record<string, {
    firstDayHotel: string;
    firstDayRoomNo: string;
    secondDayHotel: string;
    secondDayRoomNo: string;
  }> = {};

  table.rows.forEach((row) => {
    const roomGroup = readOptional_(row, table.header, "房間編組");
    if (!roomGroup) return;
    map[roomGroup] = {
      firstDayHotel: readOptional_(row, table.header, "第一天飯店"),
      firstDayRoomNo: readOptional_(row, table.header, "第一天房號"),
      secondDayHotel: readOptional_(row, table.header, "第二天飯店"),
      secondDayRoomNo: readOptional_(row, table.header, "第二天房號"),
    };
  });
  return map;
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
