// `npm run db:start` — runs the local embedded Postgres in the foreground (Ctrl+C to stop).
import { startEmbedded } from "./pg.mjs";
import { ensureEnv } from "./env.mjs";

const PORT = Number(process.env.PGPORT_LOCAL ?? 54329);
const { pg, url } = await startEmbedded({ dir: ".data/pg", port: PORT, database: "zenorra" });
ensureEnv(url);
console.log(`Postgres running on 127.0.0.1:${PORT} (database "zenorra"). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
