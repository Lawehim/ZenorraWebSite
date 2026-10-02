import { db } from "@/lib/db";
import { currentUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { buildStatementPdf } from "@/server/services/buyer-docs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = await currentUser();
  if (!u || !can(u.role, "buyers.view")) return new Response("Forbidden", { status: 403 });
  const p = await db.purchase.findUnique({ where: { id: (await params).id } });
  if (!p) return new Response("Not found", { status: 404 });
  const pdf = await buildStatementPdf(p.buyerId, p.id);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="statement-${p.reference}.pdf"`, "Cache-Control": "no-store" } });
}
