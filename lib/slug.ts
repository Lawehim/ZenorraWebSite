const MAX = 80;

export function slugify(input: string): string {
  const s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining marks: Ọ̀ṣunlolá → Osunlola
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const capped = s.slice(0, MAX).replace(/-+$/g, "");
  return capped || "untitled";
}

export async function uniqueSlug(input: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const base = slugify(input);
  if (!(await isTaken(base))) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base.slice(0, MAX - String(i).length - 1)}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base.slice(0, MAX - 9)}-${Date.now().toString(36)}`;
}
