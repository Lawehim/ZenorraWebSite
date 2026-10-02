// `npm run dev` — starts the embedded Postgres, then `next dev`, and stops both together.
import { spawn } from "node:child_process";
import fs from "node:fs";
import { startEmbedded } from "./pg.mjs";
import { ensureEnv } from "./env.mjs";

const PORT = Number(process.env.PGPORT_LOCAL ?? 54329);
const { pg, url } = await startEmbedded({ dir: ".data/pg", port: PORT, database: "zenorra" });
ensureEnv(url);
if (!fs.existsSync(".data/.seeded")) {
  console.log("First run: run `npm run db:setup` once to create tables and sample content.");
}

const next = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? url },
});

const stop = async () => {
  next.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
next.on("exit", stop);
