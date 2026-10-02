import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { lagosDateString } from "@/lib/bookings/dates";
import { PurchaseForm } from "@/components/admin/PurchaseForm";

export const metadata = { title: "Record a sale" };

export default async function NewPurchase({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  await requirePageUser("buyers.manage", "/admin/buyers");
  const { leadId } = await searchParams;
  const lead = leadId ? await db.lead.findUnique({ where: { id: leadId } }) : null;
  if (!lead) notFound();
  const properties = await db.property.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, priceNaira: true, depositPercent: true, planMonths: true } });
  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href={`/admin/leads/${lead.id}`}>{lead.reference}</Link> / Record a sale
          </p>
          <h1>Record a sale for {lead.name}</h1>
          <p>Creates the buyer&apos;s portal account (by invitation), the purchase and the full instalment schedule. The lead is marked Closed — won.</p>
        </div>
      </div>
      <PurchaseForm
        leadId={lead.id}
        defaultPropertyId={lead.propertyId ?? properties[0]?.id ?? ""}
        today={lagosDateString(new Date())}
        properties={properties.map((p) => ({ id: p.id, name: p.name, price: Number(p.priceNaira), depositPercent: p.depositPercent, planMonths: p.planMonths }))}
        hasContact={Boolean(lead.email || lead.phoneE164)}
      />
    </>
  );
}
