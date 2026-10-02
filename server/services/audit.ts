import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "./actor";

type Tx = Prisma.TransactionClient | typeof db;

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));
}

export async function audit(
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  change: { before?: unknown; after?: unknown; ip?: string } = {},
  tx: Tx = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      action,
      entityType,
      entityId,
      before: toJson(change.before),
      after: toJson(change.after),
      ip: change.ip,
    },
  });
}
