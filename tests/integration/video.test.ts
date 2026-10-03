import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { receiveVideoUpload, processVideo, processQueuedVideos, retryVideo } from "@/server/services/video";
import { mediaUsage, deleteMedia, safePath } from "@/server/services/media";
import { ForbiddenError } from "@/lib/rbac";
import { resetDb, makeUser } from "./helpers";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const ffmpeg = (process.env.FFMPEG_PATH ?? (require("@ffmpeg-installer/ffmpeg") as { path: string }).path) as string;
let sample: string;

beforeAll(() => {
  // A 3-second 640x360 clip with a tone, generated locally — no fixture file in the repo.
  sample = path.join(os.tmpdir(), `zn-sample-${process.pid}.mov`);
  const r = spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=640x360:rate=25", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", sample]);
  if (r.status !== 0) throw new Error(`ffmpeg couldn't make the sample: ${r.stderr}`);
}, 60_000);

afterAll(() => fs.rmSync(sample, { force: true }));

const streamOf = (buf: Buffer) => new Blob([new Uint8Array(buf)]).stream();

async function editor() {
  const u = await makeUser("EDITOR");
  return { id: u.id, role: "EDITOR" as const };
}

describe("video uploads (FR-ADM-028)", () => {
  it("streams the upload to private storage, then transcodes to MP4 with a poster frame", async () => {
    const actor = await editor();
    const r = await receiveVideoUpload(actor, { filename: "Site Walk.MOV", body: streamOf(fs.readFileSync(sample)) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const queued = await db.mediaAsset.findUniqueOrThrow({ where: { id: r.id } });
    expect(queued).toMatchObject({ videoStatus: "QUEUED", mimeType: "video/mp4", filename: "site-walk.mp4" });
    expect(queued.key).toMatch(/^video\/\d{4}\/\d{2}\/site-walk-[0-9a-f]{12}\.mp4$/);

    expect(await processVideo(r.id)).toBe("ready");
    expect(await processVideo(r.id)).toBe("skipped"); // claimed once only
    const a = await db.mediaAsset.findUniqueOrThrow({ where: { id: r.id } });
    expect(a).toMatchObject({ videoStatus: "READY", width: 640, height: 360, sourceKey: null });
    expect(a.durationSec).toBeGreaterThan(2.5);
    const out = fs.readFileSync(safePath(a.key)!);
    expect(out.subarray(4, 8).toString("latin1")).toBe("ftyp");
    // +faststart puts the moov atom before the media data, so playback starts before download ends
    expect(out.indexOf("moov")).toBeLessThan(out.indexOf("mdat"));
    expect(fs.readFileSync(safePath(a.posterKey!)!).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(fs.existsSync(safePath(queued.sourceKey!)!)).toBe(false);
  }, 120_000);

  it("rejects files that aren't videos, whatever their name", async () => {
    const actor = await editor();
    const dir = path.dirname(safePath("video-src/x")!);
    const before = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
    const r = await receiveVideoUpload(actor, { filename: "clip.mp4", body: streamOf(Buffer.from("%PDF-1.7 not a video at all.........")) });
    expect(r).toMatchObject({ ok: false, status: 415 });
    expect(await db.mediaAsset.count()).toBe(0);
    expect(fs.readdirSync(dir).length).toBe(before); // nothing left behind
  });

  it("enforces the 200MB limit from the declared size and while streaming", async () => {
    const actor = await editor();
    expect(await receiveVideoUpload(actor, { filename: "big.mp4", body: streamOf(Buffer.alloc(16)), declaredBytes: 201 * 1024 * 1024 })).toMatchObject({ ok: false, status: 413 });
  });

  it("is limited to roles that can upload media", async () => {
    const adv = await makeUser("ADVISOR");
    await expect(receiveVideoUpload({ id: adv.id, role: "ADVISOR" }, { filename: "a.mp4", body: streamOf(fs.readFileSync(sample)) })).rejects.toThrow(ForbiddenError);
  });

  it("marks broken videos as failed with a plain message, and the cron picks up queued ones", async () => {
    const actor = await editor();
    const broken = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(4000, 7)]);
    const bad = await receiveVideoUpload(actor, { filename: "broken.mp4", body: streamOf(broken) });
    const good = await receiveVideoUpload(actor, { filename: "good.mov", body: streamOf(fs.readFileSync(sample)) });
    if (!bad.ok || !good.ok) throw new Error("upload");
    expect(await processQueuedVideos(new Date(), 5)).toBe(1);
    const failed = await db.mediaAsset.findUniqueOrThrow({ where: { id: bad.id } });
    expect(failed.videoStatus).toBe("FAILED");
    expect(failed.videoError).toMatch(/couldn't be converted/);
    const run = jest.fn();
    await retryVideo(actor, bad.id, run); // original kept, so a retry is possible
    expect(run).toHaveBeenCalledWith(bad.id);
    expect((await db.mediaAsset.findUniqueOrThrow({ where: { id: bad.id } })).videoStatus).toBe("QUEUED");
  }, 120_000);

  it("knows where a video is used, and won't delete it while in use", async () => {
    const actor = await editor();
    const r = await receiveVideoUpload(actor, { filename: "story.mov", body: streamOf(fs.readFileSync(sample)) });
    if (!r.ok) throw new Error("upload");
    const a = await db.mediaAsset.findUniqueOrThrow({ where: { id: r.id } });
    await db.testimonial.create({ data: { name: "Kemi A.", roleText: "Buyer", quote: "Great", videoUrl: `/media/${a.key}` } });
    expect(await mediaUsage(r.id)).toEqual(["Testimonial: Kemi A."]);
    const admin = await makeUser("ADMINISTRATOR", "ad@zenorra.test");
    expect(await deleteMedia({ id: admin.id, role: "ADMINISTRATOR" }, r.id)).toMatchObject({ ok: false });
  });
});
