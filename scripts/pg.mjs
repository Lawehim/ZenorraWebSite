// Embedded PostgreSQL helper — a real Postgres server whose binaries come from npm,
// so local development needs no installed database or shared credentials.
// Production uses DATABASE_URL pointing at a managed Postgres (Neon per SRS §7.3).
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

export const LOCAL_USER = "zenorra";
export const LOCAL_PASSWORD = "zenorra-local-dev";

/** True when something already accepts connections on the port (e.g. `npm run db:start` in another terminal). */
export function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.setTimeout(1000, () => (s.destroy(), resolve(false)));
  });
}

/** Start the embedded server, or reuse one already running on the port. */
export async function ensureEmbedded({ dir, port, database }) {
  if (await portInUse(port)) {
    return { pg: null, url: `postgresql://${LOCAL_USER}:${LOCAL_PASSWORD}@127.0.0.1:${port}/${database}?schema=public`, reused: true };
  }
  return { ...(await startEmbedded({ dir, port, database })), reused: false };
}

export async function startEmbedded({ dir, port, database }) {
  const databaseDir = path.resolve(dir);
  const fresh = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: LOCAL_USER,
    password: LOCAL_PASSWORD,
    port,
    persistent: true,
    // UTF-8 is required for ₦, →, Yoruba diacritics and emoji; Windows would otherwise default to WIN1252.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
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
