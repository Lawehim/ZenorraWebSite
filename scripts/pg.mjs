// Embedded PostgreSQL helper — a real Postgres server whose binaries come from npm,
// so local development needs no installed database or shared credentials.
// Production uses DATABASE_URL pointing at a managed Postgres (Neon per SRS §7.3).
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

export const LOCAL_USER = "zenorra";
export const LOCAL_PASSWORD = "zenorra-local-dev";

export async function startEmbedded({ dir, port, database }) {
  const databaseDir = path.resolve(dir);
  const fresh = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: LOCAL_USER,
    password: LOCAL_PASSWORD,
    port,
    persistent: true,
    onLog: () => {},
    onError: (e) => process.env.PG_DEBUG && console.error(String(e)),
  });
  if (fresh) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(database);
  } catch {
    // already exists
  }
  const url = `postgresql://${LOCAL_USER}:${LOCAL_PASSWORD}@127.0.0.1:${port}/${database}?schema=public`;
  return { pg, url, fresh };
}
