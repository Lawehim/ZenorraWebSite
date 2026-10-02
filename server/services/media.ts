// Media library (FR-ADM-020..026, SRS §7.9). Storage sits behind a tiny adapter:
// local disk outside the web root now; Cloudflare R2 (S3 API) in production.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { sniffImage } from "@/lib/media/sniff";
import { slugify } from "@/lib/slug";
import { audit } from "./audit";
import type { Actor } from "./actor";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;
export const DERIVATIVE_WIDTHS = [400, 800, 1200, 1920, 2560];

function root() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_DIR ?? "uploads");
}

/** Resolve a storage key safely — no traversal outside the media root (TC-SEC-013). */
export function safePath(key: string): string | null {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) return null;
  const full = path.resolve(/*turbopackIgnore: true*/ root(), key);
  return full.startsWith(root() + path.sep) ? full : null;
}

async function write(key: string, data: Buffer) {
  const full = safePath(key)!;
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });
  await fs.writeFile(/*turbopackIgnore: true*/ full, data);
}

export async function readStored(key: string): Promise<Buffer> {
  const full = safePath(key);
  if (!full) throw new Error("Invalid key");
  return fs.readFile(/*turbopackIgnore: true*/ full);
}

export interface Derivative {
  width: number;
  format: "webp" | "avif" | "jpeg";
  key: string;
  bytes: number;
}

export type UploadResult = { ok: true; asset: Prisma.MediaAssetGetPayload<object> } | { ok: false; message: string };

export async function uploadMedia(actor: Actor, file: { filename: string; bytes: Buffer }): Promise<UploadResult> {
  assertCan(actor.role, "media.upload");
  const name = path.basename(file.filename || "image");
  if (file.bytes.length > MAX_UPLOAD_BYTES) return { ok: false, message: `${name} is larger than the 15MB limit.` };
  const type = sniffImage(file.bytes);
  if (!type) {
    await audit(actor, "media.rejected", "MediaAsset", null, { after: { filename: name, reason: "type" } });
    return { ok: false, message: `${name} isn't a supported image. Upload JPEG, PNG, WebP or AVIF.` };
  }

  let image: sharp.Sharp;
  let meta: sharp.Metadata;
  try {
    image = sharp(file.bytes, { failOn: "error" }).rotate(); // apply EXIF orientation, then drop metadata
    meta = await sharp(file.bytes).metadata();
  } catch {
    return { ok: false, message: `${name} appears to be damaged and couldn't be read.` };
  }
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;

  const stem = slugify(name.replace(/\.[^.]+$/, "")).slice(0, 50);
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const id = crypto.randomBytes(6).toString("hex");
  const key = `${dir}/${stem}-${id}.${type.ext}`;

  // Original re-encoded without metadata (EXIF/GPS stripped — TC-ADM-016).
  const original = await image.clone().toFormat(type.ext === "jpg" ? "jpeg" : type.ext, { quality: 90 }).toBuffer();
  await write(key, original);

  const derivatives: Derivative[] = [];
  const widths = DERIVATIVE_WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);
  for (const w of widths) {
    for (const format of ["webp", "avif", "jpeg"] as const) {
      const dkey = `${dir}/${stem}-${id}-${w}.${format === "jpeg" ? "jpg" : format}`;
      const out = await image.clone().resize({ width: w, withoutEnlargement: true }).toFormat(format, { quality: format === "avif" ? 55 : 78 }).toBuffer();
      await write(dkey, out);
      derivatives.push({ width: w, format, key: dkey, bytes: out.length });
    }
  }

  const asset = await db.mediaAsset.create({
    data: {
      key,
      filename: `${stem}.${type.ext}`,
      mimeType: type.mime,
      bytes: original.length,
      width,
      height,
      derivatives: derivatives as unknown as Prisma.InputJsonValue,
      uploadedBy: actor.id,
    },
  });
  await audit(actor, "media.upload", "MediaAsset", asset.id, { after: { filename: asset.filename, bytes: asset.bytes } });
  return { ok: true, asset };
}

export async function mediaUsage(id: string): Promise<string[]> {
  const [props, posts, testimonials, content] = await Promise.all([
    db.propertyMedia.findMany({ where: { mediaAssetId: id }, include: { property: { select: { name: true } } } }),
    db.post.findMany({ where: { coverMediaId: id }, select: { title: true } }),
    db.testimonial.findMany({ where: { mediaAssetId: id }, select: { name: true } }),
    db.contentBlock.findMany({ select: { key: true, data: true } }),
  ]);
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { key: true } });
  const inContent = asset ? content.filter((c) => JSON.stringify(c.data).includes(`/media/${asset.key}`)).map((c) => `Site content (${c.key})`) : [];
  return [...props.map((p) => p.property.name), ...posts.map((p) => p.title), ...testimonials.map((t) => `Testimonial: ${t.name}`), ...inContent];
}

export async function deleteMedia(actor: Actor, id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  assertCan(actor.role, "media.delete");
  const used = await mediaUsage(id);
  if (used.length) return { ok: false, message: `This image is used by: ${used.join(", ")}. Remove it there first.` };
  await db.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(actor, "media.delete", "MediaAsset", id);
  return { ok: true };
}

export async function updateMediaMeta(actor: Actor, id: string, input: { alt?: string; caption?: string }) {
  assertCan(actor.role, "media.upload");
  const before = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  const data = { alt: input.alt?.trim().slice(0, 250) ?? before.alt, caption: input.caption?.trim().slice(0, 300) ?? before.caption };
  await db.mediaAsset.update({ where: { id }, data });
  await audit(actor, "media.update", "MediaAsset", id, { before: { alt: before.alt, caption: before.caption }, after: data });
}

/** Public URL for an asset (served by app/media/[...key]/route.ts). */
export function mediaUrl(key: string) {
  return `/media/${key}`;
}

/** Best derivative for a target width and format. */
export function pickDerivative(derivatives: unknown, width: number, format: Derivative["format"] = "webp"): Derivative | null {
  const list = (Array.isArray(derivatives) ? derivatives : []) as Derivative[];
  const ofFormat = list.filter((d) => d.format === format).sort((a, b) => a.width - b.width);
  return ofFormat.find((d) => d.width >= width) ?? ofFormat.at(-1) ?? null;
}
