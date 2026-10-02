// Buyer document vault (signed, expiring links) and generated PDFs (FR-PORT-004/007, FR-PAY-004).
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { renderTextPdf } from "@/lib/pdf";
import { formatKobo } from "@/lib/payments/paystack";
import { outstanding, arrears } from "@/lib/payments/schedule";
import { formatDateLagos } from "@/lib/format";

const LINK_MINUTES = 15;

function sign(payload: string) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "dev-only-secret").update(payload).digest("base64url");
}

export function documentLink(docId: string, buyerId: string, now: Date = new Date()) {
  const exp = now.getTime() + LINK_MINUTES * 60_000;
  const token = `${exp}.${sign(`${docId}|${buyerId}|${exp}`)}`;
  return { token, url: `/api/account/documents/${docId}?t=${token}` };
}

export function verifyDocumentLink(token: string, docId: string, buyerId: string, now: Date = new Date()): boolean {
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp < now.getTime()) return false;
  const expected = sign(`${docId}|${buyerId}|${exp}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function root() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR ?? "uploads", "private");
}

export async function storePrivateFile(key: string, data: Buffer) {
  const full = path.join(/*turbopackIgnore: true*/ root(), key);
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ full, data);
}

export async function readPrivateFile(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("Invalid key");
  return fs.readFile(/*turbopackIgnore: true*/ path.join(root(), key));
}

export async function buildStatementPdf(buyerId: string, purchaseId: string): Promise<Buffer> {
  const p = await db.purchase.findFirst({ where: { id: purchaseId, buyerId }, include: { property: true, buyer: true, instalments: { orderBy: { sequence: "asc" }, include: { payments: { where: { status: "SUCCESS" } } } } } });
  if (!p) throw new Error("Not found");
  const now = new Date();
  const lines = [
    `Buyer: ${p.buyer.name}`,
    `Property: ${p.property.name}${p.plotNumber ? ` - Plot ${p.plotNumber}` : ""}`,
    `Purchase reference: ${p.reference}`,
    `Price: ${formatKobo(p.priceKobo)}   Plan: ${p.planMonths} months`,
    "",
    "Schedule",
    ...p.instalments.map((i) => `${i.label.padEnd(24)} due ${formatDateLagos(i.dueDate).padEnd(18)} ${formatKobo(i.amountKobo).padStart(16)}   paid ${formatKobo(i.paidKobo).padStart(16)}   ${i.status}`),
    "",
    "Payments received",
    ...p.instalments.flatMap((i) => i.payments.map((pay) => `${pay.paidAt ? formatDateLagos(pay.paidAt) : ""}  ${pay.receiptNumber ?? pay.providerRef}  ${formatKobo(pay.amountKobo)}  (${pay.provider})`)),
    "",
    `Total paid: ${formatKobo(p.instalments.reduce((s, i) => s + i.paidKobo, 0n))}`,
    `Outstanding balance: ${formatKobo(outstanding(p.instalments))}`,
    `Arrears at ${formatDateLagos(now)}: ${formatKobo(arrears(p.instalments.map((i) => ({ ...i, id: i.id })), now))}`,
  ];
  return renderTextPdf({ title: "Statement of account", subtitle: `Zenorra Limited - generated ${formatDateLagos(now)}`, lines });
}

export function buildReceiptPdf(r: { receiptNumber: string; buyer: string; property: string; plot: string | null; purchaseRef: string; amountKobo: bigint; method: string; paidAt: Date; balanceKobo: bigint }) {
  return renderTextPdf({
    title: `Receipt ${r.receiptNumber}`,
    subtitle: "Zenorra Limited - 139 Ogunlana Drive, Masha/Surulere, Lagos",
    lines: [
      `Received from: ${r.buyer}`,
      `Amount: ${formatKobo(r.amountKobo)}`,
      `Payment method: ${r.method}`,
      `Date: ${formatDateLagos(r.paidAt)}`,
      `Property: ${r.property}${r.plot ? ` - Plot ${r.plot}` : ""}`,
      `Purchase reference: ${r.purchaseRef}`,
      `Remaining balance: ${formatKobo(r.balanceKobo)}`,
      "",
      "Thank you. Keep this receipt with your contract and allocation documents.",
    ],
  });
}
