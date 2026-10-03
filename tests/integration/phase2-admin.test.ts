import { db } from "@/lib/db";
import { listLeads } from "@/server/services/leads";
import { uploadDocument, updateMediaMeta, listUnusedMedia, uploadMedia } from "@/server/services/media";
import { attachPropertyDocument, removePropertyDocument } from "@/server/services/properties";
import { getPublicProperty } from "@/server/services/properties";
import { saveTeamMember, savePartner, deleteTeamMember } from "@/server/services/people";
import { ForbiddenError } from "@/lib/rbac";
import sharp from "sharp";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const pdf = Buffer.from("%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n");
const jpeg = () => sharp({ create: { width: 40, height: 30, channels: 3, background: "#e4b04a" } }).jpeg().toBuffer();

describe("lead inbox sorting and filters (FR-LEAD-018, FR-ADM-041)", () => {
  it("sorts by score and filters by assignee", async () => {
    const adv = await makeUser("ADVISOR");
    await db.lead.createMany({
      data: [
        { reference: "ZN-2026-00001", name: "Low", source: "advisor", score: 10 },
        { reference: "ZN-2026-00002", name: "High", source: "advisor", score: 90, assignedToId: adv.id },
      ],
    });
    expect((await listLeads({ sort: "score" })).rows.map((l) => l.name)).toEqual(["High", "Low"]);
    expect((await listLeads({ assignedToId: adv.id })).rows.map((l) => l.name)).toEqual(["High"]);
    expect((await listLeads({ assignedToId: "unassigned" })).rows.map((l) => l.name)).toEqual(["Low"]);
  });
});

describe("property documents (FR-PROP-015, FR-ADM-036, TC-PROP-017)", () => {
  it("accepts PDFs by content, and only public documents reach the public page", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    const p = await db.property.create({ data: { reference: "ZNR-1", slug: "p1", name: "P1", corridor: "Epe", locationText: "Epe", titleType: "GAZETTE", priceNaira: 1n, status: "PUBLISHED" } });
    const brochure = await uploadDocument(actor, { filename: "brochure.pdf", bytes: pdf });
    const internal = await uploadDocument(actor, { filename: "price-list.pdf", bytes: pdf });
    if (!brochure.ok || !internal.ok) throw new Error("upload failed");
    await attachPropertyDocument(actor, p.id, { mediaAssetId: brochure.asset.id, label: "Brochure", kind: "brochure", isPublic: true });
    await attachPropertyDocument(actor, p.id, { mediaAssetId: internal.asset.id, label: "Internal price list", kind: "price-list", isPublic: false });
    const pub = await getPublicProperty("p1");
    if (pub.kind !== "property") throw new Error();
    expect(pub.property.documents.map((d) => d.label)).toEqual(["Brochure"]);
    const doc = await db.propertyDocument.findFirstOrThrow({ where: { label: "Brochure" } });
    await removePropertyDocument(actor, doc.id);
    expect(await db.propertyDocument.count()).toBe(1);
  });
  it("rejects non-PDF documents", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const r = await uploadDocument({ id: admin.id, role: "ADMINISTRATOR" }, { filename: "x.pdf", bytes: Buffer.from("MZ......executable") });
    expect(r.ok).toBe(false);
  });
});

describe("media focal point and unused filter (FR-ADM-027/029)", () => {
  it("stores a focal point within 0..1 and lists unused assets", async () => {
    const ed = await makeUser("EDITOR");
    const actor = { id: ed.id, role: "EDITOR" as const };
    const a = await uploadMedia(actor, { filename: "a.jpg", bytes: await jpeg() });
    const b = await uploadMedia(actor, { filename: "b.jpg", bytes: await jpeg() });
    if (!a.ok || !b.ok) throw new Error();
    await updateMediaMeta(actor, a.asset.id, { focalX: 0.2, focalY: 1.7 });
    const saved = await db.mediaAsset.findUniqueOrThrow({ where: { id: a.asset.id } });
    expect([saved.focalX, saved.focalY]).toEqual([0.2, 1]);
    await db.testimonial.create({ data: { name: "T", roleText: "r", quote: "q", mediaAssetId: b.asset.id } });
    expect((await listUnusedMedia()).map((m) => m.id)).toEqual([a.asset.id]);
  });
});

describe("team and partners (FR-CORP-003/006)", () => {
  it("lets editors manage team members and partners; viewers cannot", async () => {
    const ed = await makeUser("EDITOR");
    const viewer = await makeUser("VIEWER");
    const actor = { id: ed.id, role: "EDITOR" as const };
    const m = await saveTeamMember(actor, null, { name: "Emeka", roleText: "Senior advisor", bio: "", order: 1, published: true });
    await savePartner(actor, null, { name: "Coral Developments", kind: "DEVELOPER", url: "https://coral.example", order: 1, published: true });
    expect(await db.teamMember.count()).toBe(1);
    expect(await db.partner.count()).toBe(1);
    await expect(saveTeamMember({ id: viewer.id, role: "VIEWER" }, null, { name: "x", roleText: "y" })).rejects.toThrow(ForbiddenError);
    await expect(savePartner(actor, null, { name: "Bad", kind: "DEVELOPER", url: "javascript:alert(1)" })).rejects.toThrow();
    await deleteTeamMember(actor, m.id);
    expect(await db.teamMember.count()).toBe(0);
  });
});
