import { sniffImage } from "@/lib/media/sniff";

const bytes = (...xs: (number | string)[]) =>
  Uint8Array.from(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])).concat(Array(16).fill(0)));

describe("sniffImage (FR-ADM-021, TC-ADM-015)", () => {
  it("detects JPEG, PNG, WebP and AVIF by magic bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(sniffImage(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(sniffImage(bytes("RIFF", 0, 0, 0, 0, "WEBP"))?.ext).toBe("webp");
    expect(sniffImage(bytes(0, 0, 0, 0x1c, "ftypavif"))?.ext).toBe("avif");
  });
  it("rejects executables, PDFs, SVG and GIF", () => {
    expect(sniffImage(bytes("MZ"))).toBeNull();
    expect(sniffImage(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffImage(bytes("<svg xmlns"))).toBeNull();
    expect(sniffImage(bytes("GIF89a"))).toBeNull();
  });
  it("rejects tiny buffers", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});
