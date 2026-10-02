import { requirePageUser } from "@/server/auth/session";
import { leadsReport } from "@/server/services/reports";
import { lagosDateString } from "@/lib/bookings/dates";

export const metadata = { title: "Reports" };

function Table({ title, rows, total }: { title: string; rows: { key: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="card" style={{ marginBottom: "1rem" }}>
      <h2>{title}</h2>
      <table className="tbl">
        <thead>
          <tr>
            <th scope="col">{title.replace("Leads by ", "")}</th>
            <th scope="col">Leads</th>
            <th scope="col">Share</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key}</td>
              <td className="mono">{r.count}</td>
              <td className="mono">{total ? Math.round((r.count / total) * 100) : 0}%</td>
              <td style={{ width: "40%" }} aria-hidden="true">
                <div className="bar-chart">
                  <div className="track">
                    <div className="fill" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4}>No leads in this period.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageUser("reports.view", "/admin/reports");
  const sp = await searchParams;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : lagosDateString(new Date());
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : lagosDateString(new Date(Date.now() - 29 * 86400_000));
  const r = await leadsReport({ from: new Date(`${from}T00:00:00+01:00`), to: new Date(`${to}T23:59:59+01:00`) });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Reports</h1>
          <p>
            {r.total} leads and {r.won} closed sales between {from} and {to} (WAT).
          </p>
        </div>
        <a className="btn btn-line btn-sm" href={`/api/admin/reports/export?from=${from}&to=${to}`}>
          Export CSV
        </a>
      </div>
      <form className="toolbar-row">
        <div className="field">
          <label htmlFor="from">From</label>
          <input id="from" name="from" type="date" className="inp" defaultValue={from} />
        </div>
        <div className="field">
          <label htmlFor="to">To</label>
          <input id="to" name="to" type="date" className="inp" defaultValue={to} />
        </div>
        <button className="btn btn-line btn-sm" type="submit">
          Update
        </button>
      </form>
      <Table title="Leads by source" rows={r.bySource} total={r.total} />
      <Table title="Leads by property" rows={r.byProperty} total={r.total} />
      <Table title="Leads by advisor" rows={r.byAdvisor} total={r.total} />
    </>
  );
}
