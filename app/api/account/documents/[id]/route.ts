// Buyer document download: requires the owner's session AND a valid, unexpired signed link
// (FR-PORT-004, TC-SEC-005). Links can't be shared with another account.
import { db } from "@/lib/db";
import { currentBuyer } from "@/server/auth/buyer-session";
import { verifyDocumentLink, readPrivateFile } from "@/server/services/buyer-docs";
import { readStored } from "@/server/services/media";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await currentBuyer();
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!b || !verifyDocumentLink(t, id, b.id)) return new Response("This link has expired. Open the document again from your portal.", { status: 403 });
  const doc = await db.buyerDocument.findFirst({ where: { id, buyerId: b.id }, include: { mediaAsset: true } });
  if (!doc) return new Response("Not found", { status: 404 });
  const key = doc.storageKey ?? doc.mediaAsset?.key;
  if (!key) return new Response("Not found", { status: 404 });
  const bytes = doc.storageKey ? await readPrivateFile(doc.storageKey) : await readStored(key);
  const ext = key.split(".").pop()?.toLowerCase();
  const type = ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": type, "Content-Disposition": `inline; filename="${doc.title.replace(/[^\w .-]/g, "")}.${ext}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
