import fs from "node:fs/promises";
import path from "node:path";

const rootDir = "D:/_LINE BOT/_TRAVEL_APP";
const gasDir = path.join(rootDir, "gas");
const buildDir = path.join(gasDir, "build");

await fs.mkdir(buildDir, { recursive: true });
await fs.copyFile(path.join(gasDir, "appsscript.json"), path.join(buildDir, "appsscript.json"));
