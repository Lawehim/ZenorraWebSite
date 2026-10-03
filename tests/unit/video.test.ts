import { sniffVideo, parseDuration, transcodeArgs, posterArgs, posterKeyFor, isUploadedVideoUrl, posterUrlFor, parseRange, MAX_VIDEO_BYTES } from "@/lib/media/video";
import { fieldSchema } from "@/lib/content/fields";

const ftyp = (brand: string) => Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftyp" + brand), Buffer.alloc(20)]);

describe("sniffVideo (FR-ADM-028) — by content, not file name", () => {
  it("recognises MP4, QuickTime and WebM", () => {
    expect(sniffVideo(ftyp("isom"))?.ext).toBe("mp4");
    expect(sniffVideo(ftyp("mp42"))?.ext).toBe("mp4");
    expect(sniffVideo(ftyp("qt  "))?.ext).toBe("mov");
    expect(sniffVideo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))?.ext).toBe("webm");
  });
  it("rejects images, PDFs, executables and short buffers", () => {
    expect(sniffVideo(Buffer.from("%PDF-1.7 ......."))).toBeNull();
    expect(sniffVideo(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(sniffVideo(Buffer.from("MZ\x90\x00........"))).toBeNull();
    expect(sniffVideo(Buffer.from([0, 0]))).toBeNull();
  });
  it("allows up to 200MB", () => {
    expect(MAX_VIDEO_BYTES).toBe(200 * 1024 * 1024);
  });
});

describe("ffmpeg plumbing", () => {
  it("reads the duration from ffmpeg's log", () => {
    expect(parseDuration("  Duration: 00:01:02.50, start: 0.000000, bitrate: 1205 kb/s")).toBe(62.5);
    expect(parseDuration("Duration: 01:00:00.00,")).toBe(3600);
    expect(parseDuration("no duration here")).toBeNull();
  });
  it("transcodes to web-friendly H.264/AAC MP4, at most 1280px wide, with fast start", () => {
    const a = transcodeArgs("in.mov", "out.mp4");
    expect(a).toEqual(expect.arrayContaining(["-i", "in.mov", "libx264", "aac", "+faststart", "yuv420p", "out.mp4"]));
    expect(a.join(" ")).toMatch(/scale='min\(1280,iw\)':-2/);
    expect(a).toContain("-y");
  });
  it("extracts a single poster frame", () => {
    const a = posterArgs("in.mov", "poster.jpg", 1.5);
    expect(a).toEqual(expect.arrayContaining(["-ss", "1.5", "-i", "in.mov", "-frames:v", "1", "poster.jpg"]));
  });
});

describe("video links", () => {
  it("derives the poster from the video key", () => {
    expect(posterKeyFor("video/2026/10/site-walk-ab12cd.mp4")).toBe("video/2026/10/site-walk-ab12cd-poster.jpg");
    expect(posterUrlFor("/media/video/2026/10/site-walk-ab12cd.mp4")).toBe("/media/video/2026/10/site-walk-ab12cd-poster.jpg");
  });
  it("recognises uploaded video links only", () => {
    expect(isUploadedVideoUrl("/media/video/2026/10/site-walk-ab12cd.mp4")).toBe(true);
    expect(isUploadedVideoUrl("https://youtu.be/abcdefghijk")).toBe(false);
    expect(isUploadedVideoUrl("/media/video/../../etc/passwd.mp4")).toBe(false);
    expect(isUploadedVideoUrl("/media/2026/10/photo.jpg")).toBe(false);
  });
  it("validates the video content field", () => {
    const s = fieldSchema({ name: "video", label: "Background video", type: "video", optional: true });
    expect(s.safeParse("").success).toBe(true);
    expect(s.safeParse("/media/video/2026/10/site-walk-ab12cd.mp4").success).toBe(true);
    expect(s.safeParse("https://evil.example/x.mp4").success).toBe(false);
  });
});

describe("parseRange — byte ranges so phones can seek and Safari can play", () => {
  it("parses the forms browsers send", () => {
    expect(parseRange("bytes=0-", 1000)).toEqual({ start: 0, end: 999 });
    expect(parseRange("bytes=100-199", 1000)).toEqual({ start: 100, end: 199 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });
  it("returns null with no header and 'invalid' for unsatisfiable ranges", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=5-2", 1000)).toBe("invalid");
    expect(parseRange("items=0-1", 1000)).toBe("invalid");
  });
});
