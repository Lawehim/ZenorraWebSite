import Link from "next/link";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { listVideos } from "@/server/services/video";
import { mediaUsage } from "@/server/services/media";
import { VideoManager } from "@/components/admin/VideoManager";

export const metadata = { title: "Videos" };

function duration(s: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
}

export default async function VideosAdmin() {
  const user = await requirePageUser("media.upload", "/admin/media/videos");
  const videos = await listVideos();
  const usage = await Promise.all(videos.map((v) => mediaUsage(v.id)));
  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/media">Media library</Link> / Videos
          </p>
          <h1>Videos</h1>
          <p>Use a video as the homepage background (Site content → Home → Hero) or on a testimonial (Testimonials → Video).</p>
        </div>
      </div>
      <VideoManager
        canDelete={can(user.role, "media.delete")}
        videos={videos.map((v, i) => ({
          id: v.id,
          url: `/media/${v.key}`,
          poster: v.posterKey ? `/media/${v.posterKey}` : null,
          filename: v.filename,
          status: v.videoStatus ?? "QUEUED",
          error: v.videoError,
          duration: duration(v.durationSec),
          size: `${(v.bytes / 1024 / 1024).toFixed(1)}MB`,
          usedBy: usage[i],
        }))}
      />
    </>
  );
}
