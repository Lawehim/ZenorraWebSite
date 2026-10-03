// Serves uploaded media from outside the web root (NFR-SEC-012). Responses are sandboxed
// and never sniffed, so an upload can't execute in the site's context. Videos support byte
// ranges so browsers can seek and Safari/iOS will play them.
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { readStored, safePath } from "@/server/services/media";
import { parseRange } from "@/lib/media/video";
import { db } from "@/lib/db";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", pdf: "application/pdf", mp4: "video/mp4" };

const MAX_CHUNK = 4 * 1024 * 1024; // browsers ask again for the rest

const BASE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy": "same-site",
};

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  // Video originals are private until transcoded and are never served.
  if (!TYPES[ext] || !safePath(key) || key.startsWith("video-src/")) return new Response("Not found", { status: 404 });
  // Documents are only served when attached to a property as public (FR-PROP-015, TC-PROP-017).
  if (key.startsWith("docs/")) {
    const pub = await db.propertyDocument.findFirst({ where: { isPublic: true, mediaAsset: { key, deletedAt: null } } });
    if (!pub) return new Response("Not found", { status: 404 });
  }
  if (ext === "mp4") return serveVideo(req, key);
  try {
    const body = await readStored(key);
    return new Response(new Uint8Array(body), { headers: { "Content-Type": TYPES[ext], ...BASE_HEADERS } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function serveVideo(req: Request, key: string) {
  const ready = await db.mediaAsset.findFirst({ where: { key, videoStatus: "READY", deletedAt: null }, select: { id: true } });
  if (!ready) return new Response("Not found", { status: 404 });
  const full = safePath(key)!;
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(/*turbopackIgnore: true*/ full, "r");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  try {
    const { size } = await handle.stat();
    const range = parseRange(req.headers.get("range"), size);
    if (range === "invalid") return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const headers = { "Content-Type": "video/mp4", "Accept-Ranges": "bytes", ...BASE_HEADERS };
    if (!range) {
      const stream = Readable.toWeb(createReadStream(/*turbopackIgnore: true*/ full)) as ReadableStream<Uint8Array>;
      return new Response(stream, { headers: { ...headers, "Content-Length": String(size) } });
    }
    const end = Math.min(range.end, range.start + MAX_CHUNK - 1);
    const length = end - range.start + 1;
    const buf = Buffer.alloc(length);
    await handle.read(buf, 0, length, range.start);
    return new Response(new Uint8Array(buf), { status: 206, headers: { ...headers, "Content-Length": String(length), "Content-Range": `bytes ${range.start}-${end}/${size}` } });
  } finally {
    await handle.close();
  }
}
