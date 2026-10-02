import sharp from "sharp";
import { db } from "@/lib/db";
import { uploadMedia, deleteMedia, updateMediaMeta, MAX_UPLOAD_BYTES } from "@/server/services/media";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function jpeg(width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 228, g: 176, b: 74 } } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: "secret-gps-test" } } })
    .toBuffer();
}

describe("media library (FR-ADM-020..026, TC-ADM-013..018)", () => {
  it("accepts a JPEG, records dimensions and generates derivatives", async () => {
    const editor = await makeUser("EDITOR");
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "heritage.jpg", bytes: await jpeg(1300, 975) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = await db.mediaAsset.findUniqueOrThrow({ where: { id: r.asset.id } });
    expect(a).toMatchObject({ width: 1300, height: 975, mimeType: "image/jpeg" });
    const d = a.derivatives as { width: number; format: string }[];
    expect(d.map((x) => `${x.width}.${x.format}`)).toEqual(expect.arrayContaining(["400.webp", "800.webp", "1200.webp", "400.avif"]));
    expect(d.some((x) => x.width > 1300)).toBe(false);
  });

  it("detects type by content, not extension (TC-ADM-015)", async () => {
    const editor = await makeUser("EDITOR");
    const exe = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200)]);
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "photo.jpg", bytes: exe });
    expect(r).toEqual({ ok: false, message: "photo.jpg isn't a supported image. Upload JPEG, PNG, WebP or AVIF." });
  });

  it("accepts a real image with the wrong extension and corrects it", async () => {
    const editor = await makeUser("EDITOR");
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).png().toBuffer();
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "plan.jpg", bytes: png });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.asset.filename).toBe("plan.png");
  });

  it("rejects files over 15MB naming the file and the limit (TC-ADM-014)", async () => {
    const editor = await makeUser("EDITOR");
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "huge.jpg", bytes: Buffer.alloc(MAX_UPLOAD_BYTES + 1) });
    expect(r).toEqual({ ok: false, message: "huge.jpg is larger than the 15MB limit." });
  });

  it("strips EXIF metadata from stored files (TC-ADM-016)", async () => {
    const editor = await makeUser("EDITOR");
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "gps.jpg", bytes: await jpeg() });
    if (!r.ok) throw new Error(r.message);
    const { readStored } = await import("@/server/services/media");
    const stored = await readStored(r.asset.key);
    const meta = await sharp(stored).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it("refuses to delete an asset in use and names the items (TC-ADM-018)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const actor = { id: admin.id, role: "ADMINISTRATOR" as const };
    const r = await uploadMedia(actor, { filename: "a.jpg", bytes: await jpeg() });
    if (!r.ok) throw new Error();
    await db.property.create({
      data: { reference: "ZNR-1", slug: "p1", name: "Palm Haven", corridor: "Epe", locationText: "Epe", titleType: "GAZETTE", priceNaira: 1n, media: { create: { mediaAssetId: r.asset.id } } },
    });
    const d = await deleteMedia(actor, r.asset.id);
    expect(d).toEqual({ ok: false, message: "This image is used by: Palm Haven. Remove it there first." });
  });

  it("soft-deletes an unused asset; Editors cannot delete (RBAC)", async () => {
    const admin = await makeUser("ADMINISTRATOR");
    const editor = await makeUser("EDITOR");
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "a.jpg", bytes: await jpeg() });
    if (!r.ok) throw new Error();
    await expect(deleteMedia({ id: editor.id, role: "EDITOR" }, r.asset.id)).rejects.toThrow(ForbiddenError);
    expect(await deleteMedia({ id: admin.id, role: "ADMINISTRATOR" }, r.asset.id)).toEqual({ ok: true });
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: r.asset.id } })).deletedAt).not.toBeNull();
  });

  it("updates alt text and caption", async () => {
    const editor = await makeUser("EDITOR");
    const r = await uploadMedia({ id: editor.id, role: "EDITOR" }, { filename: "a.jpg", bytes: await jpeg() });
    if (!r.ok) throw new Error();
    await updateMediaMeta({ id: editor.id, role: "EDITOR" }, r.asset.id, { alt: "Aerial view of Heritage Gardens", caption: "Phase 2" });
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: r.asset.id } })).alt).toBe("Aerial view of Heritage Gardens");
  });
});
