// `npm run build` — public pages are pre-rendered from the database, so the build needs it.
// Locally that's the embedded Postgres (started here and stopped afterwards); in production
// DATABASE_URL points at the managed database and this script simply runs `next build`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { ensureEmbedded } from "./pg.mjs";

const env = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";
const url = process.env.DATABASE_URL ?? /DATABASE_URL="?([^"\n]+)"?/.exec(env)?.[1] ?? "";
const local = /127\.0\.0\.1:54329|localhost:54329/.test(url);

let pg = null;
if (local) ({ pg } = await ensureEmbedded({ dir: ".data/pg", port: 54329, database: "zenorra" }));
const r = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "build"], { stdio: "inherit", shell: process.platform === "win32" });
if (pg) await pg.stop();
process.exit(r.status ?? 1);
