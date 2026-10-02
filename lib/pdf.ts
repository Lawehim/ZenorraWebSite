// Minimal dependency-free PDF writer for statements and receipts (FR-PORT-007, FR-PAY-004).
// Text-only, Helvetica, A4, automatic pagination. Characters outside Latin-1 are transliterated.

const W = 595;
const H = 842;
const MARGIN = 56;
const LINE = 16;
const PER_PAGE = Math.floor((H - MARGIN * 2 - 60) / LINE);

function latin1(s: string): string {
  return s
    .replace(/₦/g, "NGN ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\xff]/g, "?");
}

function esc(s: string): string {
  return latin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderTextPdf({ title, subtitle, lines }: { title: string; subtitle?: string; lines: string[] }): Buffer {
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(1, lines.length); i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE));

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // object number
  };
  const catalog = add(""); // placeholder 1
  const pagesObj = add(""); // placeholder 2
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const pageNums: number[] = [];
  pages.forEach((pl, idx) => {
    let y = H - MARGIN;
    let content = `BT /F2 16 Tf ${MARGIN} ${y} Td (${esc(title)}) Tj ET\n`;
    y -= 20;
    if (subtitle) content += `BT /F1 9 Tf ${MARGIN} ${y} Td (${esc(subtitle)}) Tj ET\n`;
    y -= 30;
    for (const l of pl) {
      content += `BT /F1 10 Tf ${MARGIN} ${y} Td (${esc(l)}) Tj ET\n`;
      y -= LINE;
    }
    content += `BT /F1 8 Tf ${MARGIN} ${MARGIN - 20} Td (${esc(`Zenorra Limited - page ${idx + 1} of ${pages.length}`)}) Tj ET\n`;
    const stream = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`);
    pageNums.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${font} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
