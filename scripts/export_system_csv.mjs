import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const rootDir = "D:/_LINE BOT/_TRAVEL_APP";
const inputPath = path.join(rootDir, "outputs", "system_data.xlsx");
const outputDir = path.join(rootDir, "outputs", "csv");
const sheetNames = ["people", "settings", "itinerary", "contacts"];

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

await fs.mkdir(outputDir, { recursive: true });

const exported = [];
for (const sheetName of sheetNames) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getUsedRange().values;
  const outputPath = path.join(outputDir, `${sheetName}.csv`);
  await fs.writeFile(outputPath, `\uFEFF${toCsv(values)}`, "utf8");
  exported.push({ sheetName, outputPath, rows: values.length });
}

console.log(JSON.stringify({ ok: true, exported }, null, 2));
