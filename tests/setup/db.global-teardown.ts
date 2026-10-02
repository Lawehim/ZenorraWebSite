export default async function globalTeardown() {
  const pg = (globalThis as Record<string, unknown>).__ZN_PG__ as { stop: () => Promise<void> } | undefined;
  await pg?.stop();
}
