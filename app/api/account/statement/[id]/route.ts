import { currentBuyer } from "@/server/auth/buyer-session";
import { buildStatementPdf } from "@/server/services/buyer-docs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const b = await currentBuyer();
  if (!b) return new Response("Sign in required", { status: 401 });
  try {
    const pdf = await buildStatementPdf(b.id, (await params).id);
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="zenorra-statement.pdf"', "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
