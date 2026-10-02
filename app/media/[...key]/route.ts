// Serves uploaded images from outside the web root (NFR-SEC-012). Responses are sandboxed
// and never sniffed, so an upload can't execute in the site's context.
import { readStored, safePath } from "@/server/services/media";

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (!TYPES[ext] || !safePath(key)) return new Response("Not found", { status: 404 });
  try {
    const body = await readStored(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
