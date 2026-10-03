import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { markLeadRead } from "@/server/services/leads";
import { formatDateTimeLagos } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { whatsappLink } from "@/lib/whatsapp";
import { LeadStatusSelect } from "@/components/admin/LeadStatusSelect";
import { LeadNoteForm } from "@/components/admin/LeadNoteForm";
import { AssignSelect } from "@/components/admin/AssignSelect";
import { StatusPill, statusLabel } from "@/components/ui/StatusPill";

export const metadata = { title: "Lead" };

function describe(a: { type: string; payload: unknown }): string {
  const p = (a.payload ?? {}) as Record<string, unknown>;
  switch (a.type) {
    case "enquiry":
      return `Enquiry via ${p.source ?? "form"}${p.property ? ` about ${p.property}` : ""}${p.pagePath ? ` (from ${p.pagePath})` : ""}`;
    case "status":
      return `Status changed: ${statusLabel(String(p.from))} → ${statusLabel(String(p.to))}`;
    case "note":
      return String(p.text ?? "");
    case "assigned":
      return p.to ? `Assigned (${p.mode ?? "manual"})` : "Unassigned";
    case "escalated":
      return "Escalated — first-response deadline passed";
    case "chat":
      return `Chat: ${p.text}`;
    case "whatsapp-in":
      return `WhatsApp: ${p.text}`;
    case "opt-out":
      return `Opted out of ${p.channel}`;
    case "purchase":
      return `Sale recorded: ${p.property} plot ${p.plot ?? ""} (${p.purchase})`;
    case "referral":
      return `Referred by ${p.referrer} (${p.code})`;
    case "referral-rejected":
      return `Referral code ${p.code} rejected (${p.reason})`;
    case "delivery-failed":
      return `Message delivery failed on ${p.channel} to ${p.to}`;
    default:
      return a.type;
  }
}

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageUser("leads.view", `/admin/leads/${id}`);
  const lead = await db.lead.findUnique({
    where: { id },
    include: { assignedTo: { select: { id: true, name: true } }, chats: { include: { messages: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } }, buyer: { include: { purchases: { include: { property: true } } } }, property: true, activities: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } }, consents: true, bookings: { include: { property: true }, orderBy: { date: "desc" } } },
  });
  if (!lead) notFound();
  if (can(user.role, "leads.edit")) await markLeadRead(id);
  const utm = (lead.utm ?? {}) as Record<string, string>;
  const consent = lead.consents.at(-1);
  const rows: [string, string | null | undefined][] = [
    ["Objective", lead.objective],
    ["Locations", lead.corridors.join(", ")],
    ["Budget", lead.budgetBand],
    ["Timeline", lead.timeline],
    ["Buying from", lead.residency],
    ["Enquiry type", lead.enquiryType],
    ["Property", lead.property?.name],
    ["Their note", lead.note],
    ["Best time to call", lead.callbackWindow],
    ["WhatsApp updates", lead.whatsappOptIn ? "Opted in" : null],
  ];
  const staff = can(user.role, "leads.assign") ? await db.user.findMany({ where: { role: { in: ["ADVISOR", "ADMINISTRATOR", "SUPER_ADMIN"] }, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/leads">Leads</Link> / {lead.reference}
          </p>
          <h1>
            {lead.name} <StatusPill status={lead.status} />
          </h1>
          <p>Received {formatDateTimeLagos(lead.createdAt)}</p>
        </div>
        <div className="rowacts">
          {lead.phoneE164 && (
            <>
              <a className="btn btn-gold btn-sm" href={`tel:${lead.phoneE164}`}>
                Call {displayPhone(lead.phoneE164)}
              </a>
              <a className="btn btn-line btn-sm" href={whatsappLink(lead.phoneE164, `Hello ${lead.name.split(" ")[0]}, this is Zenorra following up on your enquiry ${lead.reference}.`)} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </>
          )}
          {lead.email && (
            <a className="btn btn-line btn-sm" href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your Zenorra enquiry ${lead.reference}`)}`}>
              Email
            </a>
          )}
        </div>
      </div>
      <div className="editor-grid">
        <div>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Qualification brief</h2>
            <dl className="brief">
              {rows
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
            </dl>
          </section>
          {lead.bookings.length > 0 && (
            <section className="card" style={{ marginBottom: "1rem" }}>
              <h2>Inspections</h2>
              <ul className="timeline">
                {lead.bookings.map((b) => (
                  <li key={b.id}>
                    <time>{b.date.toISOString().slice(0, 10)}</time>
                    {b.property?.name ?? "Undecided estate"} · {b.seats} seat(s) · {b.departurePoint} · <StatusPill status={b.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {lead.chats.length > 0 && (
            <section className="card" style={{ marginBottom: "1rem" }}>
              <h2>Live chat</h2>
              {lead.chats.map((c) => (
                <div key={c.id} style={{ marginBottom: "1rem" }}>
                  <a className="mono" style={{ fontSize: ".7rem" }} href={`/admin/chat/${c.id}`}>
                    Chat started {formatDateTimeLagos(c.createdAt)}
                  </a>
                  {c.messages.map((m) => (
                    <p key={m.id} className={`bubble ${m.sender === "VISITOR" ? "them" : "me"}`} style={{ margin: ".3rem 0" }}>
                      {m.body}
                    </p>
                  ))}
                </div>
              ))}
            </section>
          )}
          <section className="card">
            <h2>Timeline</h2>
            {can(user.role, "leads.edit") && <LeadNoteForm id={lead.id} />}
            <ul className="timeline" style={{ marginTop: "1.2rem" }}>
              {lead.activities.map((a) => (
                <li key={a.id}>
                  <time dateTime={a.createdAt.toISOString()}>
                    {formatDateTimeLagos(a.createdAt)} · {a.actor?.name ?? "Website"}
                  </time>
                  {describe(a)}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Status</h2>
            {can(user.role, "leads.edit") ? <LeadStatusSelect id={lead.id} status={lead.status} /> : <StatusPill status={lead.status} />}
            <p style={{ marginTop: ".8rem", fontSize: ".86rem" }}>
              Score <b className="mono">{lead.score ?? "—"}</b>
              {lead.firstResponseDueAt && lead.status === "NEW" && <> · first contact due {formatDateTimeLagos(lead.firstResponseDueAt)}</>}
              {lead.escalatedAt && lead.status === "NEW" && <span className="pill draft" style={{ marginLeft: ".4rem" }}>Past SLA</span>}
            </p>
            <div style={{ marginTop: ".8rem" }}>
              <span className="label">Advisor </span>
              {can(user.role, "leads.assign") ? <AssignSelect leadId={lead.id} current={lead.assignedToId} users={staff} /> : <b>{lead.assignedTo?.name ?? "Unassigned"}</b>}
            </div>
            {can(user.role, "buyers.manage") && (
              <a className="btn btn-gold btn-sm" style={{ marginTop: "1rem" }} href={`/admin/purchases/new?leadId=${lead.id}`}>
                Record a sale
              </a>
            )}
            {lead.buyer?.purchases.map((p) => (
              <p key={p.id} style={{ fontSize: ".84rem", marginTop: ".6rem" }}>
                <a href={`/admin/purchases/${p.id}`}>{p.reference}</a> — {p.property.name} {p.plotNumber ? `plot ${p.plotNumber}` : ""}
              </p>
            ))}
            {lead.lastContactedAt && <p className="muted" style={{ fontSize: ".8rem", marginTop: ".6rem" }}>Last contact {formatDateTimeLagos(lead.lastContactedAt)}</p>}
          </section>
          <section className="card" style={{ marginBottom: "1rem" }}>
            <h2>Contact</h2>
            <dl className="brief">
              <dt>Phone</dt>
              <dd>{displayPhone(lead.phoneE164) || "—"}</dd>
              <dt>Email</dt>
              <dd>
                {lead.email ?? "—"}
                {lead.disposableEmail && <span className="pill draft" style={{ marginLeft: ".4rem" }}>disposable</span>}
              </dd>
              <dt>Marketing</dt>
              <dd>{lead.marketingConsent ? `Consented${consent ? ` (${consent.textVersion})` : ""}` : "No consent — enquiry follow-up only"}</dd>
            </dl>
          </section>
          <section className="card">
            <h2>Attribution</h2>
            <dl className="brief">
              <dt>Source</dt>
              <dd>{lead.source}</dd>
              {Object.entries(utm).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k.replace("utm_", "")}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <dt>Landing page</dt>
              <dd>{lead.landingPath ?? "—"}</dd>
              <dt>Form page</dt>
              <dd>{lead.pagePath ?? "—"}</dd>
              <dt>Referrer</dt>
              <dd>{lead.referrer ?? "Direct"}</dd>
              <dt>Device</dt>
              <dd>{lead.deviceClass ?? "—"}</dd>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
