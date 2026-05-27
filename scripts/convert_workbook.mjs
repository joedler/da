import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const rootDir = "D:/_LINE BOT/_TRAVEL_APP";
const sourcePath = path.join(rootDir, "畢業旅行彙整名單_v5.xlsx");
const outputDir = path.join(rootDir, "outputs");
const outputPath = path.join(outputDir, "system_data.xlsx");

const busSheets = ["A車", "B車", "C車", "D車", "E車", "F車"];
const headers = [
  "person_id",
  "類別",
  "姓名",
  "班級或職稱",
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
  "備註",
];

const normalize = (value) => String(value ?? "").trim();

function makePersonId(index) {
  return `P${String(index).padStart(4, "0")}`;
}

function getLast3(value) {
  const digits = normalize(value).replace(/\D/g, "");
  return digits.length >= 3 ? digits.slice(-3) : "";
}

function readPeopleFromBusSheets(workbook) {
  const people = [];

  for (const sheetName of busSheets) {
    const sheet = workbook.worksheets.getItem(sheetName);
    const values = sheet.getRange("A1:K80").values;
    const headerIndex = values.findIndex((row) => row.includes("類別") && row.includes("姓名"));
    if (headerIndex < 0) {
      throw new Error(`找不到 ${sheetName} 的欄位列`);
    }

    const headerRow = values[headerIndex].map(normalize);
    const col = Object.fromEntries(headerRow.map((name, index) => [name, index]));

    for (const row of values.slice(headerIndex + 1)) {
      const type = normalize(row[col["類別"]]);
      const name = normalize(row[col["姓名"]]);

      if (!name || !["老師", "學生"].includes(type)) continue;

      const idOrPhone = normalize(row[col["手機/學號"]]);
      const vegetarian = normalize(row[col["素食"]]);

      people.push({
        type,
        name,
        roleClass: normalize(row[col["職稱/班級"]]),
        studentId: type === "學生" ? idOrPhone : "",
        phoneLast3: type === "老師" ? getLast3(idOrPhone) : "",
        bus: sheetName,
        tableNo: normalize(row[col["桌號"]]),
        roomNo: "",
        roomGroup: normalize(row[col["房間"]]),
        vegetarian,
        note: "",
      });
    }
  }

  const roomMembers = new Map();
  for (const person of people) {
    if (!person.roomGroup) continue;
    if (!roomMembers.has(person.roomGroup)) roomMembers.set(person.roomGroup, []);
    roomMembers.get(person.roomGroup).push(person.name);
  }

  return people.map((person, index) => ({
    personId: makePersonId(index + 1),
    ...person,
    lineUserId: "",
    boundAt: "",
    roomMembers: roomMembers.get(person.roomGroup)?.join("、") ?? "",
  }));
}

function addSheetWithRows(workbook, sheetName, rows) {
  const sheet = workbook.worksheets.add(sheetName);
  sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).values = rows;
  sheet.getRangeByIndexes(0, 0, 1, rows[0].length).format = {
    fill: "#0F766E",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.freezePanes.freezeRows(1);
  sheet.getUsedRange().format.autofitColumns();
  return sheet;
}

function buildPeopleRows(people) {
  return [
    headers,
    ...people.map((person) => [
      person.personId,
      person.type,
      person.name,
      person.roleClass,
      person.studentId,
      person.phoneLast3,
      person.lineUserId,
      person.boundAt,
      person.bus,
      person.tableNo,
      person.roomNo,
      person.roomGroup,
      person.roomMembers,
      person.vegetarian,
      person.note,
    ]),
  ];
}

function buildSettingsRows(people) {
  const students = people.filter((person) => person.type === "學生").length;
  const teachers = people.filter((person) => person.type === "老師").length;

  return [
    ["key", "value", "說明"],
    ["activity_name", "高中畢業旅行", "畫面顯示活動名稱"],
    ["spreadsheet_id", "SET_IN_SCRIPT_PROPERTIES", "正式 Google Sheets ID"],
    ["table_meal_label", "指定餐次桌號", "分桌只有一餐使用，之後可改成實際餐次"],
    ["room_number_status", "尚未公告", "飯店提供房號後更新 people 房號欄位"],
    ["total_people", String(people.length), "轉換後總人數"],
    ["total_students", String(students), "學生人數"],
    ["total_teachers", String(teachers), "老師人數"],
  ];
}

const itineraryRows = [
  ["天數", "日期", "開始時間", "結束時間", "地點", "行程標題", "行程說明", "集合地點", "注意事項", "餐食類型", "是否需要提醒"],
  ["第1天", "", "", "", "", "", "", "", "", "", ""],
  ["第2天", "", "", "", "", "", "", "", "", "", ""],
  ["第3天", "", "", "", "", "", "", "", "", "", ""],
];

const contactRows = [
  ["類型", "姓名", "服務車次", "電話", "LINE或其他聯絡方式", "備註"],
  ["旅行社領隊", "", "", "", "", ""],
  ["學校窗口", "", "", "", "", ""],
  ["隨車老師", "", "", "", "", ""],
];

const sourceBlob = await FileBlob.load(sourcePath);
const sourceWorkbook = await SpreadsheetFile.importXlsx(sourceBlob);
const people = readPeopleFromBusSheets(sourceWorkbook);

const outputWorkbook = Workbook.create();
addSheetWithRows(outputWorkbook, "people", buildPeopleRows(people));
addSheetWithRows(outputWorkbook, "settings", buildSettingsRows(people));
addSheetWithRows(outputWorkbook, "itinerary", itineraryRows);
addSheetWithRows(outputWorkbook, "contacts", contactRows);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(outputWorkbook);
await output.save(outputPath);

console.log(JSON.stringify({
  outputPath,
  people: people.length,
  students: people.filter((person) => person.type === "學生").length,
  teachers: people.filter((person) => person.type === "老師").length,
  rooms: new Set(people.map((person) => person.roomGroup).filter(Boolean)).size,
  buses: busSheets.length,
}, null, 2));
