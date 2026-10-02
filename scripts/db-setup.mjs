// `npm run db:setup` — start the embedded DB, push the schema, apply SQL guards, seed, stop.
import { execSync } from "node:child_process";
import { ensureEmbedded } from "./pg.mjs";
import { ensureEnv } from "./env.mjs";

const PORT = Number(process.env.PGPORT_LOCAL ?? 54329);
const { pg, url } = await ensureEmbedded({ dir: ".data/pg", port: PORT, database: "zenorra" });
ensureEnv(url);
const env = { ...process.env, DATABASE_URL: url };
try {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit", env });
  execSync("npx prisma db execute --file prisma/sql/audit-immutable.sql --schema prisma/schema.prisma", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
} finally {
  await pg?.stop();
}
console.log("Database ready. Run `npm run dev`.");
