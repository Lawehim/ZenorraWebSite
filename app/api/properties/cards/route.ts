// Card data for a list of slugs — used by the shortlist page (FR-PROP-019).
import { db } from "@/lib/db";
import { propertyInclude } from "@/server/services/properties";
import { toPropertyCard } from "@/server/queries/mappers";

export async function GET(req: Request) {
  const slugs = (new URL(req.url).searchParams.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,80}$/.test(s))
    .slice(0, 30);
  if (!slugs.length) return Response.json({ cards: [] });
  const rows = await db.property.findMany({ where: { slug: { in: slugs }, status: { in: ["PUBLISHED", "SOLD_OUT"] }, deletedAt: null }, include: propertyInclude });
  const order = new Map(slugs.map((s, i) => [s, i]));
  return Response.json({ cards: rows.sort((a, b) => order.get(a.slug)! - order.get(b.slug)!).map(toPropertyCard) });
}
