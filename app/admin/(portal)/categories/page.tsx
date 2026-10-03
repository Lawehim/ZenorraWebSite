import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata = { title: "Categories" };

export default async function Categories() {
  await requirePageUser("posts.edit", "/admin/categories");
  const cats = await db.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Article categories</h1>
          <p>Rename, merge or delete categories. A category in use must be merged into another before it can be deleted. New categories are created from the article editor.</p>
        </div>
      </div>
      <CategoryManager cats={cats.map((c) => ({ id: c.id, name: c.name, count: c._count.posts }))} />
    </>
  );
}
