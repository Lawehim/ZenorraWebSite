import { db } from "@/lib/db";

/** Truncate every table except the append-only audit log trigger function. */
export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(", ");
  // TRUNCATE does not fire row-level DELETE triggers, so it can clear AuditLog between tests.
  if (list) await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export async function makeUser(role: "SUPER_ADMIN" | "ADMINISTRATOR" | "EDITOR" | "ADVISOR" | "VIEWER", email = `${role.toLowerCase()}@zenorra.test`) {
  return db.user.create({ data: { email, name: role, role, status: "ACTIVE" } });
}
