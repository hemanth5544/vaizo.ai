import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const envPaths = [
  resolve(moduleDir, "../../../.env"),
  resolve(moduleDir, "../../.env"),
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
];

for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path });
  }
}
