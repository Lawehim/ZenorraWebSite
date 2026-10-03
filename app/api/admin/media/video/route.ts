// Video upload (raw request body, streamed to disk — FR-ADM-028) and listing for pickers.
// Not under the /admin proxy matcher, so the body isn't buffered by the proxy.
import { revalidatePath } from "next/cache";
import { currentUser, toActor } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { receiveVideoUpload, processVideoSoon, listVideos } from "@/server/services/video";
import { json, sameOrigin } from "@/server/http";

export async function GET() {
  const u = await currentUser();
  if (!u || !can(u.role, "media.upload")) return json({ ok: false }, 403);
  const videos = await listVideos();
  return json({
    videos: videos.map((v) => ({ id: v.id, url: `/media/${v.key}`, poster: v.posterKey ? `/media/${v.posterKey}` : null, filename: v.filename, status: v.videoStatus, durationSec: v.durationSec })),
  });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ ok: false, message: "Upload refused." }, 403);
  const u = await currentUser();
  if (!u || !can(u.role, "media.upload")) return json({ ok: false, message: "Your role can't upload media." }, 403);
  const filename = decodeURIComponent(req.headers.get("x-filename") ?? "video");
  const r = await receiveVideoUpload(toActor(u), { filename, body: req.body, declaredBytes: Number(req.headers.get("content-length") ?? 0) });
  if (!r.ok) return json({ ok: false, message: r.message }, r.status);
  processVideoSoon(r.id);
  revalidatePath("/admin/media/videos");
  return json({ ok: true, id: r.id });
}
