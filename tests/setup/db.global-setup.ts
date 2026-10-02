// Integration tests run against a real, throwaway Postgres (SRS §8.1 "real ephemeral database").
import { execSync } from "node:child_process";

export const TEST_PORT = 54339;

export default async function globalSetup() {
  // @ts-expect-error — plain .mjs helper shared with the dev scripts
  const { startEmbedded } = await import("../../scripts/pg.mjs");
  const { pg, url } = await startEmbedded({ dir: ".data/pg-test", port: TEST_PORT, database: "zenorra_test" });
  (globalThis as Record<string, unknown>).__ZN_PG__ = pg;
  process.env.DATABASE_URL = url;
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma db push --force-reset --skip-generate --accept-data-loss", { stdio: "pipe", env });
  execSync("npx prisma db execute --file prisma/sql/audit-immutable.sql --schema prisma/schema.prisma", { stdio: "pipe", env });
}
