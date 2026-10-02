// Integration tests run against a real, throwaway Postgres (SRS §8.1 "real ephemeral database").
// Each run initialises a brand-new cluster in a fresh temp directory on a free port, so the schema
// is pushed onto an empty database — nothing is ever reset or dropped.
import { execSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
  });
}

export default async function globalSetup() {
  // @ts-expect-error — plain .mjs helper shared with the dev scripts
  const { startEmbedded } = await import("../../scripts/pg.mjs");
  const dir = path.join(os.tmpdir(), `zenorra-pg-test-${process.pid}-${Date.now()}`);
  const { pg, url } = await startEmbedded({ dir, port: await freePort(), database: "zenorra_test" });
  const g = globalThis as Record<string, unknown>;
  g.__ZN_PG__ = pg;
  g.__ZN_PG_DIR__ = dir;
  process.env.DATABASE_URL = url; // inherited by test workers
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma db push --skip-generate", { stdio: "pipe", env });
  execSync("npx prisma db execute --file prisma/sql/audit-immutable.sql --schema prisma/schema.prisma", { stdio: "pipe", env });
}
