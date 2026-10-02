import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { TestimonialsManager } from "@/components/admin/TestimonialsManager";

export const metadata = { title: "Testimonials" };

export default async function TestimonialsAdmin() {
  await requirePageUser("testimonials.manage", "/admin/testimonials");
  const items = await db.testimonial.findMany({ orderBy: { order: "asc" } });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Testimonials</h1>
          <p>Client quotes shown in the homepage carousel, in the order below. Only use quotes clients have agreed to publish.</p>
        </div>
      </div>
      <TestimonialsManager items={items.map((t) => ({ id: t.id, name: t.name, roleText: t.roleText, quote: t.quote, initials: t.initials ?? "", videoUrl: t.videoUrl ?? "", order: t.order, published: t.published }))} />
    </>
  );
}
