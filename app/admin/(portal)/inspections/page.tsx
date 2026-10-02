import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { lagosDateString } from "@/lib/bookings/dates";
import { displayPhone } from "@/lib/phone";
import { StatusPill } from "@/components/ui/StatusPill";
import { BookingActions } from "@/components/admin/BookingActions";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Inspections" };

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default async function Inspections({ searchParams }: { searchParams: Promise<{ date?: string; past?: string }> }) {
  await requirePageUser("inspections.manage", "/admin/inspections");
  const sp = await searchParams;
  const today = new Date(`${lagosDateString(new Date())}T00:00:00Z`);
  const where = sp.date ? { date: new Date(`${sp.date}T00:00:00Z`) } : sp.past ? { date: { lt: today } } : { date: { gte: today } };
  const bookings = await db.booking.findMany({ where, orderBy: [{ date: sp.past ? "desc" : "asc" }, { departurePoint: "asc" }], include: { lead: true, property: true }, take: 500 });
  const byDate = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const k = b.date.toISOString().slice(0, 10);
    byDate.set(k, [...(byDate.get(k) ?? []), b]);
  }
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{sp.date ? `Manifest · ${DAY.format(new Date(`${sp.date}T00:00:00Z`))}` : "Inspections"}</h1>
          <p>Confirm or cancel bookings. Cancelling texts the enquirer automatically.</p>
        </div>
        <div className="rowacts no-print">
          {sp.date && <PrintButton />}
          <Link className="btn btn-ghost btn-sm" href={sp.past ? "/admin/inspections" : "/admin/inspections?past=1"}>
            {sp.past ? "Upcoming" : "Past inspections"}
          </Link>
        </div>
      </div>
      {[...byDate.entries()].map(([date, list]) => {
        const seats = list.filter((b) => b.status !== "CANCELLED").reduce((n, b) => n + b.seats, 0);
        const perPoint = new Map<string, number>();
        list.filter((b) => b.status !== "CANCELLED").forEach((b) => perPoint.set(b.departurePoint, (perPoint.get(b.departurePoint) ?? 0) + b.seats));
        return (
          <section key={date} className="card" style={{ marginBottom: "1.2rem" }} aria-labelledby={`d-${date}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: ".8rem" }}>
              <h2 id={`d-${date}`} style={{ margin: 0 }}>
                {DAY.format(new Date(`${date}T00:00:00Z`))} · {seats} seat{seats === 1 ? "" : "s"}
              </h2>
              {!sp.date && (
                <Link className="btn btn-ghost btn-sm no-print" href={`/admin/inspections?date=${date}`}>
                  Manifest
                </Link>
              )}
            </div>
            <p className="muted" style={{ fontSize: ".82rem", marginBottom: ".8rem" }}>
              {[...perPoint.entries()].map(([p, n]) => `${p}: ${n}`).join(" · ")}
            </p>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Estate</th>
                    <th>Departure</th>
                    <th>Seats</th>
                    <th>Status</th>
                    <th className="no-print">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/admin/leads/${b.leadId}`}>
                          <b>{b.lead.name}</b>
                        </Link>
                        <div className="mono" style={{ fontSize: ".64rem", color: "var(--ink-3)" }}>
                          {b.reference}
                        </div>
                      </td>
                      <td>{displayPhone(b.lead.phoneE164)}</td>
                      <td>{b.property?.name ?? "Undecided"}</td>
                      <td>{b.departurePoint}</td>
                      <td>{b.seats}</td>
                      <td>
                        <StatusPill status={b.status} />
                      </td>
                      <td className="no-print">
                        <BookingActions id={b.id} status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {!bookings.length && <p className="muted card">No inspections booked{sp.past ? " in the past" : " yet"}.</p>}
    </>
  );
}
