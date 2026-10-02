// Upload a private document into a buyer's vault (FR-PORT-004). Stored outside the public media
// folder; only reachable through signed, expiring links for the owning buyer.
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { sniffImage } from "@/lib/media/sniff";
import { storePrivateFile } from "@/server/services/buyer-docs";
import { audit } from "@/server/services/audit";
import { enqueue } from "@/server/services/notifications";
import { json, sameOrigin } from "@/server/http";

const KINDS = ["CONTRACT", "SURVEY", "DEED", "ALLOCATION", "OTHER"];

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, message: "Upload refused." }, 403);
  const u = await currentUser();
  if (!u || !can(u.role, "buyers.manage")) return json({ ok: false, message: "Your role can't add buyer documents." }, 403);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const purchaseId = String(form?.get("purchaseId") ?? "");
  const kind = String(form?.get("kind") ?? "OTHER");
  const title = String(form?.get("title") ?? "").trim().slice(0, 100) || "Document";
  if (!(file instanceof File) || !KINDS.includes(kind)) return json({ ok: false, message: "Choose a file and type." }, 400);
  if (file.size > 15 * 1024 * 1024) return json({ ok: false, message: `${file.name} is larger than the 15MB limit.` }, 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  const img = sniffImage(bytes);
  if (!isPdf && !(img && (img.ext === "jpg" || img.ext === "png"))) return json({ ok: false, message: "Upload a PDF, JPEG or PNG." }, 422);
  const purchase = await db.purchase.findUnique({ where: { id: purchaseId }, include: { buyer: true } });
  if (!purchase) return json({ ok: false, message: "Purchase not found." }, 404);
  const key = `vault/${purchase.buyerId}/${crypto.randomBytes(8).toString("hex")}.${isPdf ? "pdf" : img!.ext}`;
  await storePrivateFile(key, bytes);
  const doc = await db.buyerDocument.create({ data: { buyerId: purchase.buyerId, purchaseId, kind, title, storageKey: key } });
  await audit(toActor(u), "vault.upload", "BuyerDocument", doc.id, { after: { kind, title, purchaseId } });
  const to = purchase.buyer.email ?? purchase.buyer.phoneE164;
  if (to) await enqueue({ channel: purchase.buyer.email ? "email" : "sms", to, template: "buyer.document", payload: { name: purchase.buyer.name, title } });
  return json({ ok: true });
}
