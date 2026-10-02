import fs from "node:fs";
import os from "node:os";

export default async function globalTeardown() {
  const g = globalThis as Record<string, unknown>;
  const pg = g.__ZN_PG__ as { stop: () => Promise<void> } | undefined;
  await pg?.stop();
  // Remove only the temp cluster this run created.
  const dir = g.__ZN_PG_DIR__ as string | undefined;
  if (dir && dir.startsWith(os.tmpdir()) && dir.includes("zenorra-pg-test-")) fs.rmSync(dir, { recursive: true, force: true });
}
