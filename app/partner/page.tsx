// Partner-developer dashboard: read-only figures for the estates this partner supplies.
import { requirePartnerUser } from "@/server/auth/session";
import { partnerDashboard } from "@/server/services/partner-portal";
import { formatKobo } from "@/lib/payments/paystack";
import { formatNaira } from "@/lib/format";
import { StatusPill } from "@/components/ui/StatusPill";

export const metadata = { title: "Overview" };

const dateFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

export default async function PartnerHome() {
  const user = await requirePartnerUser();
  const d = await partnerDashboard(user.partnerId);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{d.partner.name}</h1>
          <p>Enquiries, inspections and sales for the estates Zenorra markets for you. This view is read-only and never shows buyers&apos; personal details.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{d.totals.enquiries}</b>
          <span>Enquiries</span>
          <i>{d.totals.enquiries30d} in the last 30 days</i>
        </div>
        <div className="stat">
          <b>{d.totals.inspectionsAttended}</b>
          <span>Inspections attended</span>
        </div>
        <div className="stat">
          <b>{d.totals.plotsSold}</b>
          <span>Plots sold</span>
        </div>
        <div className="stat">
          <b>{formatKobo(d.totals.collectedKobo)}</b>
          <span>Collected</span>
          <i>of {formatKobo(d.totals.contractKobo)} contracted</i>
        </div>
      </div>

      <h2 style={{ fontSize: "1.1rem", margin: "0 0 .8rem" }}>Your estates</h2>
      {d.estates.length === 0 ? (
        <p className="muted">No estates are linked to your company yet. Your Zenorra contact can link them.</p>
      ) : (
        <div className="tblwrap" style={{ marginBottom: "2rem" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Estate</th>
                <th>Listing</th>
                <th>Price</th>
                <th>Enquiries</th>
                <th>Inspections</th>
                <th>Sold</th>
                <th>Collected</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {d.estates.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.name}</strong>
                    <div className="muted mono" style={{ fontSize: ".7rem" }}>{e.reference}</div>
                  </td>
                  <td>
                    <StatusPill status={e.status} /> <span className="muted" style={{ fontSize: ".75rem" }}>{e.availability.replace(/_/g, " ").toLowerCase()}</span>
                  </td>
                  <td>{formatNaira(e.priceNaira)}</td>
                  <td>
                    {e.enquiries} <span className="muted" style={{ fontSize: ".75rem" }}>({e.enquiries30d} / 30d)</span>
                  </td>
                  <td>
                    {e.inspectionsAttended} <span className="muted" style={{ fontSize: ".75rem" }}>of {e.inspectionsBooked} booked</span>
                  </td>
                  <td>{e.plotsSold}</td>
                  <td>{formatKobo(e.collectedKobo)}</td>
                  <td>{formatKobo(e.outstandingKobo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="two-up" style={{ alignItems: "start", gap: "1.5rem" }}>
        <section>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 .8rem" }}>Recent enquiries</h2>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Estate</th>
                  <th>Source</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {d.recentEnquiries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No enquiries yet.</td>
                  </tr>
                )}
                {d.recentEnquiries.map((l) => (
                  <tr key={l.reference}>
                    <td>{dateFmt.format(l.createdAt)}</td>
                    <td>{l.estate}</td>
                    <td>{l.source}</td>
                    <td>
                      <StatusPill status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2 style={{ fontSize: "1.1rem", margin: "0 0 .8rem" }}>Sales</h2>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Estate · plot</th>
                  <th>Price</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {d.sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">No sales yet.</td>
                  </tr>
                )}
                {d.sales.map((s) => (
                  <tr key={s.reference}>
                    <td>{dateFmt.format(s.date)}</td>
                    <td>
                      {s.estate}
                      {s.plot && ` · plot ${s.plot}`}
                    </td>
                    <td>{formatKobo(s.priceKobo)}</td>
                    <td>{s.paidPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
