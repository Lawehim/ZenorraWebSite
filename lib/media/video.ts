// Video uploads (FR-ADM-028): content sniffing, ffmpeg arguments and link helpers.
// Kept free of I/O so it can be unit-tested; the service in server/services/video.ts runs ffmpeg.

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_WIDTH = 1280;

export interface VideoType {
  ext: "mp4" | "mov" | "webm";
  mime: string;
}

/** Identify a video by its leading bytes (ISO-BMFF "ftyp" box or the EBML header). */
export function sniffVideo(head: Buffer): VideoType | null {
  if (head.length < 12) return null;
  if (head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    return brand === "qt  " ? { ext: "mov", mime: "video/quicktime" } : { ext: "mp4", mime: "video/mp4" };
  }
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { ext: "webm", mime: "video/webm" };
  return null;
}

/** "Duration: 00:01:02.50" in ffmpeg's log → 62.5 seconds. */
export function parseDuration(log: string): number | null {
  const m = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/** H.264/AAC MP4 that plays everywhere, capped at 1280px wide, moov atom first for quick start. */
export function transcodeArgs(input: string, output: string): string[] {
  return [
    "-hide_banner",
    "-y",
    "-i", input,
    "-vf", `scale='min(${MAX_VIDEO_WIDTH},iw)':-2`,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "26",
    "-profile:v", "main",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ac", "2",
    "-movflags", "+faststart",
    "-map_metadata", "-1", // drop location and device metadata, as with images
    output,
  ];
}

export function posterArgs(input: string, output: string, atSeconds: number): string[] {
  return ["-hide_banner", "-y", "-ss", String(atSeconds), "-i", input, "-frames:v", "1", "-q:v", "3", output];
}

export function posterKeyFor(videoKey: string): string {
  return videoKey.replace(/\.mp4$/, "-poster.jpg");
}

const UPLOADED = /^\/media\/video\/\d{4}\/\d{2}\/[a-z0-9-]+\.mp4$/;

export function isUploadedVideoUrl(url: string): boolean {
  return UPLOADED.test(url);
}

export function posterUrlFor(videoUrl: string): string {
  return videoUrl.replace(/\.mp4$/, "-poster.jpg");
}

/** RFC 7233 single byte range. null = no Range header; "invalid" = answer 416. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
