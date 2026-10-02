"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, monthlyInstalment, depositAmount } from "@/lib/format";
import { CORRIDORS, TITLE_TYPES, TITLE_LABELS } from "@/lib/properties/filters";
import { slugify } from "@/lib/slug";
import { savePropertyAction, setPropertyMediaAction } from "@/server/actions/properties";
import { Field } from "@/components/ui/Field";
import { useDraftRecovery } from "./useDraftRecovery";

export interface PropertyDraft {
  name: string;
  slug: string;
  reference: string;
  corridor: string;
  locationText: string;
  titleType: string;
  titleLabel: string;
  titleDocRef: string;
  sizeText: string;
  sizeSqm: string;
  priceNaira: string;
  priceUnit: string;
  depositPercent: string;
  planMonths: string;
  allocationText: string;
  appreciationNote: string;
  blurb: string;
  description: string;
  features: string;
  badges: string;
  currencies: string;
  availability: string;
  featured: boolean;
  featuredOrder: string;
  curatedOrder: string;
  heroBrief: string;
  seoTitle: string;
  seoDescription: string;
}

interface Asset {
  id: string;
  thumb: string;
  filename: string;
  alt: string | null;
}

export function PropertyForm({ id, initial, canSetPrice, assets, selectedMedia }: { id: string | null; initial: PropertyDraft; canSetPrice: boolean; assets: Asset[]; selectedMedia: string[] }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [media, setMedia] = useState<string[]>(selectedMedia);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recovery = useDraftRecovery(`property:${id ?? "new"}`, d, initial);
  const set = <K extends keyof PropertyDraft>(k: K, v: PropertyDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const preview = useMemo(() => {
    if (!/^[1-9]\d*$/.test(d.priceNaira)) return null;
    const price = BigInt(d.priceNaira);
    const dep = Number(d.depositPercent) || 0;
    const months = Number(d.planMonths) || 0;
    return { deposit: depositAmount(price, dep), monthly: months > 1 ? monthlyInstalment(price, dep, months) : null, price };
  }, [d.priceNaira, d.depositPercent, d.planMonths]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await savePropertyAction(id, { ...d });
      if (!r.ok) {
        setErrors(r.errors);
        setMsg("Fix the highlighted fields and save again.");
        const first = Object.keys(r.errors)[0];
        document.getElementById(`pf-${first}`)?.focus();
        return;
      }
      setErrors({});
      const m = await setPropertyMediaAction(r.id, media);
      recovery.clear();
      setMsg(m.ok ? "Saved. Changes reach the live site within a minute." : m.message);
      if (!id) router.replace(`/admin/properties/${r.id}`);
      else router.refresh();
    } catch (e) {
      setMsg(e instanceof Error && /Forbidden/.test(e.message) ? "Your role can't change prices or payment terms. Ask an administrator." : "Couldn't reach the server. Your changes are kept on this device — try again.");
    } finally {
      setSaving(false);
    }
  }

  const text = (k: keyof PropertyDraft, label: string, extra: { help?: string; type?: string; disabled?: boolean; placeholder?: string } = {}) => (
    <Field label={label} id={`pf-${k}`} error={errors[k]} help={extra.help}>
      {(p) => <input {...p} className="inp" type={extra.type ?? "text"} disabled={extra.disabled} placeholder={extra.placeholder} value={String(d[k])} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const area = (k: keyof PropertyDraft, label: string, help?: string, rows = 4) => (
    <Field label={label} id={`pf-${k}`} error={errors[k]} help={help}>
      {(p) => <textarea {...p} className="inp" rows={rows} value={String(d[k])} onChange={(e) => set(k, e.target.value as never)} />}
    </Field>
  );
  const strong = d.titleType === "C_OF_O" || d.titleType === "GOVERNORS_CONSENT";
  const priceLocked = Boolean(id) && !canSetPrice;

  return (
    <div className="editor-grid">
      <div>
        {recovery.available && (
          <div className="form-ok" role="status" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <span>Unsaved changes from an earlier session were found.</span>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setD(recovery.restore() as PropertyDraft)}>
              Recover them
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={recovery.clear}>
              Discard
            </button>
          </div>
        )}
        <section className="card" style={{ marginBottom: "1rem" }}>
          <h2>Identity</h2>
          {text("name", "Property name")}
          <div className="two-up">
            {text("reference", "Reference", { placeholder: "ZNR-009" })}
            {text("slug", "Web address", { help: `/properties/${d.slug || slugify(d.name || "new-property")}`, placeholder: slugify(d.name || "") })}
          </div>
          <div className="two-up">
            <Field label="Corridor" id="pf-corridor" error={errors.corridor}>
              {(p) => (
                <select {...p} className="inp" value={d.corridor} onChange={(e) => set("corridor", e.target.value)}>
                  {CORRIDORS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              )}
            </Field>
            {text("locationText", "Location shown", { placeholder: "Eleko, Ibeju-Lekki, Lagos" })}
          </div>
        </section>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <h2>Title & specification</h2>
          <div className="two-up">
            <Field label="Title type" id="pf-titleType" error={errors.titleType}>
              {(p) => (
                <select {...p} className="inp" value={d.titleType} onChange={(e) => set("titleType", e.target.value)}>
                  {TITLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TITLE_LABELS[t]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            {text("titleDocRef", strong ? "Title document reference (required)" : "Title document reference", { help: strong ? "Required before claiming C of O or Governor's Consent (NDPA/consumer protection)." : "Internal — not shown publicly." })}
          </div>
          <div className="two-up">
            {text("titleLabel", "Title wording on site (optional)", { placeholder: TITLE_LABELS[d.titleType as keyof typeof TITLE_LABELS] })}
            {text("sizeText", "Plot size shown", { placeholder: "500 sqm" })}
          </div>
          <div className="two-up">
            {text("sizeSqm", "Plot size in sqm (for filtering)", { type: "number" })}
            {text("appreciationNote", "Appreciation note", { help: "State the period, e.g. “32% p.a. (3-yr avg)”. A disclaimer is added automatically." })}
          </div>
        </section>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <h2>Price & payment plan</h2>
          {priceLocked && <p className="notice">Only administrators can change prices and payment terms.</p>}
          <div className="two-up">
            {text("priceNaira", "Price in naira (whole number)", { disabled: priceLocked, help: preview ? formatNaira(preview.price) : "Digits only, e.g. 4800000" })}
            {text("priceUnit", "Price unit", { placeholder: "per 500sqm plot" })}
          </div>
          <div className="two-up">
            {text("depositPercent", "Initial deposit %", { type: "number", disabled: priceLocked })}
            {text("planMonths", "Plan length (months)", { type: "number", disabled: priceLocked })}
          </div>
          {preview && (
            <p className="form-ok" aria-live="polite">
              Deposit {formatNaira(preview.deposit)}
              {preview.monthly ? ` · then ${formatNaira(preview.monthly)} per month for ${d.planMonths} months` : ""}
            </p>
          )}
          <div className="two-up">
            {text("allocationText", "Allocation timeline", { placeholder: "14 days after payment" })}
            {text("currencies", "Currencies accepted", { help: "Comma or line separated, e.g. NGN, GBP, USD" })}
          </div>
        </section>

        <section className="card" style={{ marginBottom: "1rem" }}>
          <h2>Description</h2>
          {area("blurb", "Short pitch (shown at the top of the page)", undefined, 3)}
          {area("description", "Full description", "Plain paragraphs. Separate paragraphs with a blank line.", 8)}
          {area("features", "Features", "One per line.", 6)}
          {area("badges", "Badges", "One per line — the first is shown on cards, e.g. “C of O”.", 3)}
        </section>

        <section className="card">
          <h2>Photographs</h2>
          <p className="muted" style={{ fontSize: ".86rem", marginBottom: "1rem" }}>
            Select images in the order you want them. The first is the card and hero image. Images need alt text first (Media library).
          </p>
          {text("heroBrief", "Photo brief for the placeholder (until photos arrive)")}
          {media.length > 0 && (
            <ol style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
              {media.map((m, i) => {
                const a = assets.find((x) => x.id === m);
                return (
                  <li key={m} className="media-item" style={{ width: 120 }}>
                    <div className="thumb">{a && <img src={a.thumb} alt={a.alt ?? ""} />}</div>
                    <div className="mi">
                      #{i + 1}
                      <span style={{ display: "flex", gap: ".2rem" }}>
                        <button type="button" aria-label={`Move image ${i + 1} earlier`} disabled={i === 0} onClick={() => setMedia((x) => x.map((y, j) => (j === i - 1 ? x[i] : j === i ? x[i - 1] : y)))}>
                          ←
                        </button>
                        <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => setMedia((x) => x.filter((y) => y !== m))}>
                          ×
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="media-grid">
            {assets.map((a) => (
              <button key={a.id} type="button" className="media-item" aria-pressed={media.includes(a.id)} disabled={!a.alt} title={a.alt ? a.filename : "Add alt text in the Media library first"} onClick={() => setMedia((x) => (x.includes(a.id) ? x.filter((y) => y !== a.id) : [...x, a.id]))}>
                <div className="thumb">
                  <img src={a.thumb} alt={a.alt ?? ""} loading="lazy" />
                </div>
                <div className="mi">
                  {a.filename}
                  {!a.alt && <span>needs alt</span>}
                </div>
              </button>
            ))}
            {!assets.length && <p className="muted">No images in the library yet.</p>}
          </div>
        </section>
      </div>

      <aside>
        <div className="card" style={{ marginBottom: "1rem", position: "sticky", top: 80 }}>
          <h2>Save</h2>
          <Field label="Availability" id="pf-availability">
            {(p) => (
              <select {...p} className="inp" value={d.availability} onChange={(e) => set("availability", e.target.value)}>
                <option value="AVAILABLE">Available</option>
                <option value="SELLING_FAST">Selling fast</option>
                <option value="SOLD_OUT">Sold out</option>
              </select>
            )}
          </Field>
          <label className="consent">
            <input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} />
            <span>Feature on the homepage</span>
          </label>
          {d.featured && text("featuredOrder", "Homepage position (1 = first)", { type: "number" })}
          {text("curatedOrder", "Catalogue order (lower = earlier)", { type: "number" })}
          <button type="button" className="btn btn-gold btn-block" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save property"}
          </button>
          <p role="status" aria-live="polite" style={{ fontSize: ".84rem", marginTop: ".8rem", color: Object.keys(errors).length ? "var(--warn)" : "var(--ok)" }}>
            {msg}
          </p>
          <p className="muted" style={{ fontSize: ".78rem" }}>
            Publishing and unpublishing is done from the property list.
          </p>
        </div>
        <div className="card">
          <h2>Search & sharing</h2>
          {text("seoTitle", "SEO title", { help: `${(d.seoTitle || d.name).length}/60` })}
          {area("seoDescription", "SEO description", `${d.seoDescription.length}/155`, 3)}
        </div>
      </aside>
    </div>
  );
}
