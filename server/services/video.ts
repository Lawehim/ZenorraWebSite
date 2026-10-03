// Video uploads and transcoding (FR-ADM-028). The upload is streamed to a private source
// file, then ffmpeg makes a web-friendly MP4 plus a poster frame in the background.
// The cron re-queues anything interrupted (e.g. by a restart).
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { assertCan } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { sniffVideo, parseDuration, transcodeArgs, posterArgs, posterKeyFor, MAX_VIDEO_BYTES } from "@/lib/media/video";
import { safePath } from "./media";
import { audit } from "./audit";
import type { Actor } from "./actor";

const STALE_MINUTES = 60;

/** FFMPEG_PATH (e.g. a system ffmpeg in production) or the binary shipped by @ffmpeg-installer. */
async function ffmpegBinary(): Promise<string> {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const mod = (await import(/*turbopackIgnore: true*/ "@ffmpeg-installer/ffmpeg")) as { path: string; default?: { path: string } };
  return mod.default?.path ?? mod.path;
}

function runFfmpeg(args: string[]): Promise<{ code: number; log: string }> {
  return ffmpegBinary().then(
    (bin) =>
      new Promise((resolve) => {
        const p = spawn(bin, args, { windowsHide: true });
        let log = "";
        p.stderr.on("data", (d: Buffer) => {
          log = (log + d.toString()).slice(-20_000);
        });
        p.on("error", (e) => resolve({ code: -1, log: String(e) }));
        p.on("close", (code) => resolve({ code: code ?? -1, log }));
      }),
  );
}

export type VideoUploadResult = { ok: true; id: string } | { ok: false; status: number; message: string };

/**
 * Stream a request body to disk (never buffering 200MB in memory), check it's really a
 * video, and queue it for transcoding.
 */
export async function receiveVideoUpload(actor: Actor, input: { filename: string; body: ReadableStream<Uint8Array> | null; declaredBytes?: number }): Promise<VideoUploadResult> {
  assertCan(actor.role, "media.upload");
  const name = path.basename(input.filename || "video");
  if (!input.body) return { ok: false, status: 400, message: "No file was received." };
  if ((input.declaredBytes ?? 0) > MAX_VIDEO_BYTES) return { ok: false, status: 413, message: `${name} is larger than the 200MB limit.` };

  const id = crypto.randomBytes(6).toString("hex");
  const sourceKey = `video-src/${id}`;
  const full = safePath(sourceKey)!;
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(full), { recursive: true });

  let bytes = 0;
  let head = Buffer.alloc(0);
  const out = createWriteStream(/*turbopackIgnore: true*/ full);
  const reader = input.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > MAX_VIDEO_BYTES) throw new RangeError("too-large");
      if (head.length < 64) head = Buffer.concat([head, Buffer.from(value.subarray(0, 64 - head.length))]);
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()));
    }
    await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())));
  } catch (e) {
    out.destroy();
    await reader.cancel().catch(() => {});
    await fs.rm(/*turbopackIgnore: true*/ full, { force: true });
    if (e instanceof RangeError) return { ok: false, status: 413, message: `${name} is larger than the 200MB limit.` };
    return { ok: false, status: 400, message: "The upload was interrupted. Please try again." };
  }

  const type = sniffVideo(head);
  if (!type) {
    await fs.rm(/*turbopackIgnore: true*/ full, { force: true });
    await audit(actor, "media.rejected", "MediaAsset", null, { after: { filename: name, reason: "type" } });
    return { ok: false, status: 415, message: `${name} isn't a supported video. Upload MP4, MOV or WebM.` };
  }

  const stem = slugify(name.replace(/\.[^.]+$/, "")).slice(0, 50) || "video";
  const now = new Date();
  const key = `video/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${stem}-${id}.mp4`;
  const asset = await db.mediaAsset.create({
    data: { key, filename: `${stem}.mp4`, mimeType: "video/mp4", bytes, alt: stem.replace(/-/g, " "), videoStatus: "QUEUED", sourceKey, posterKey: posterKeyFor(key), uploadedBy: actor.id },
  });
  await audit(actor, "media.upload", "MediaAsset", asset.id, { after: { filename: asset.filename, bytes, kind: "video" } });
  return { ok: true, id: asset.id };
}

/** Transcode one queued video. Safe to call concurrently: only one caller claims it. */
export async function processVideo(id: string): Promise<"ready" | "failed" | "skipped"> {
  const claimed = await db.mediaAsset.updateMany({ where: { id, videoStatus: "QUEUED" }, data: { videoStatus: "PROCESSING", videoError: null } });
  if (!claimed.count) return "skipped";
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  const src = asset.sourceKey ? safePath(asset.sourceKey) : null;
  const dest = safePath(asset.key);
  const poster = asset.posterKey ? safePath(asset.posterKey) : null;
  const fail = async (message: string) => {
    // The original is kept so an administrator can retry after fixing the server.
    await db.mediaAsset.update({ where: { id }, data: { videoStatus: "FAILED", videoError: message.slice(0, 300) } });
    return "failed" as const;
  };
  if (!src || !dest || !poster) return fail("Storage path is invalid.");
  await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(dest), { recursive: true });

  const t = await runFfmpeg(transcodeArgs(src, dest));
  if (t.code !== 0) return fail(t.code === -1 ? "ffmpeg isn't available on the server." : "This video couldn't be converted. Try exporting it again as MP4 (H.264).");
  const duration = parseDuration(t.log);

  const rawPoster = `${poster}.raw.jpg`;
  const pf = await runFfmpeg(posterArgs(dest, rawPoster, duration && duration > 2 ? 1 : 0));
  let width: number | null = null;
  let height: number | null = null;
  if (pf.code === 0) {
    const img = sharp(await fs.readFile(/*turbopackIgnore: true*/ rawPoster));
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    await fs.writeFile(/*turbopackIgnore: true*/ poster, await img.jpeg({ quality: 80, mozjpeg: true }).toBuffer());
    await fs.rm(/*turbopackIgnore: true*/ rawPoster, { force: true });
  }
  const { size } = await fs.stat(/*turbopackIgnore: true*/ dest);
  await db.mediaAsset.update({ where: { id }, data: { videoStatus: "READY", bytes: size, durationSec: duration, width, height, sourceKey: null } });
  await fs.rm(/*turbopackIgnore: true*/ src, { force: true });
  return "ready";
}

/** Fire-and-forget after upload; errors end up on the asset, never in the request. */
export function processVideoSoon(id: string) {
  void processVideo(id).catch((e) => console.error("video-process-failed", id, e instanceof Error ? e.message : e));
}

/** Cron: pick up queued videos and re-queue ones stuck in PROCESSING (server restarted mid-way). */
export async function processQueuedVideos(now: Date = new Date(), limit = 2): Promise<number> {
  const stale = new Date(now.getTime() - STALE_MINUTES * 60_000);
  await db.mediaAsset.updateMany({ where: { videoStatus: "PROCESSING", createdAt: { lt: stale }, sourceKey: { not: null } }, data: { videoStatus: "QUEUED" } });
  const queued = await db.mediaAsset.findMany({ where: { videoStatus: "QUEUED", deletedAt: null }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  let done = 0;
  for (const q of queued) if ((await processVideo(q.id)) === "ready") done++;
  return done;
}

export async function retryVideo(actor: Actor, id: string, run: (id: string) => void = processVideoSoon) {
  assertCan(actor.role, "media.upload");
  const a = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  if (a.videoStatus !== "FAILED" || !a.sourceKey) throw new Error("Only a failed video whose original is still stored can be retried. Upload it again.");
  await db.mediaAsset.update({ where: { id }, data: { videoStatus: "QUEUED", videoError: null } });
  await audit(actor, "media.video.retry", "MediaAsset", id);
  run(id);
}

export async function listVideos() {
  return db.mediaAsset.findMany({ where: { deletedAt: null, videoStatus: { not: null } }, orderBy: { createdAt: "desc" }, take: 200 });
}
