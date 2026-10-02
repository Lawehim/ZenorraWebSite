"use client";
import { useState, useTransition } from "react";
import { saveTeamAction, deleteTeamAction, savePartnerAction, deletePartnerAction } from "@/server/actions/phase2";

interface Img {
  id: string;
  label: string;
  thumb: string;
}
type Team = { id: string; name: string; roleText: string; bio: string; mediaAssetId: string; order: number; published: boolean };
type Partner = { id: string; name: string; kind: string; url: string; mediaAssetId: string; order: number; published: boolean };

function ImageSelect({ value, onChange, images, id }: { value: string; onChange: (v: string) => void; images: Img[]; id: string }) {
  return (
    <select id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">No image (placeholder)</option>
      {images.map((i) => (
        <option key={i.id} value={i.id}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

function TeamRow({ item, images }: { item: Team | null; images: Img[] }) {
  const [v, setV] = useState<Omit<Team, "id">>(item ?? { name: "", roleText: "", bio: "", mediaAssetId: "", order: 0, published: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = item?.id ?? "new";
  return (
    <form
      className="card"
      style={{ marginBottom: ".8rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveTeamAction(item?.id ?? null, v);
          setMsg(r.ok ? "Saved." : r.message ?? "Not saved.");
          if (r.ok && !item) setV({ name: "", roleText: "", bio: "", mediaAssetId: "", order: 0, published: true });
        });
      }}
    >
      <h3>{item ? item.name : "Add a team member"}</h3>
      <div className="two-up">
        <div className="field">
          <label htmlFor={`tn-${key}`}>Name</label>
          <input id={`tn-${key}`} className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`tr-${key}`}>Role</label>
          <input id={`tr-${key}`} className="inp" value={v.roleText} onChange={(e) => setV({ ...v, roleText: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`tb-${key}`}>Short bio (optional)</label>
        <textarea id={`tb-${key}`} className="inp" rows={2} maxLength={400} value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} />
      </div>
      <div className="two-up">
        <div className="field">
          <label htmlFor={`ti-${key}`}>Portrait</label>
          <ImageSelect id={`ti-${key}`} value={v.mediaAssetId} onChange={(x) => setV({ ...v, mediaAssetId: x })} images={images} />
        </div>
        <div className="field">
          <label htmlFor={`to-${key}`}>Position</label>
          <input id={`to-${key}`} className="inp" type="number" value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} />
        </div>
      </div>
      <label className="consent">
        <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} /> Show on the website
      </label>
      <div className="rowacts">
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
          Save
        </button>
        {item && (
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => confirm(`Remove ${item.name}?`) && start(() => deleteTeamAction(item.id))}>
            Remove
          </button>
        )}
        {msg && <span role="status">{msg}</span>}
      </div>
    </form>
  );
}

function PartnerRow({ item, images }: { item: Partner | null; images: Img[] }) {
  const [v, setV] = useState<Omit<Partner, "id">>(item ?? { name: "", kind: "DEVELOPER", url: "", mediaAssetId: "", order: 0, published: true });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const key = item?.id ?? "new";
  return (
    <form
      className="card"
      style={{ marginBottom: ".8rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePartnerAction(item?.id ?? null, v);
          setMsg(r.ok ? "Saved." : r.message ?? "Not saved.");
          if (r.ok && !item) setV({ name: "", kind: "DEVELOPER", url: "", mediaAssetId: "", order: 0, published: true });
        });
      }}
    >
      <h3>{item ? item.name : "Add a partner"}</h3>
      <div className="two-up">
        <div className="field">
          <label htmlFor={`pn-${key}`}>Name</label>
          <input id={`pn-${key}`} className="inp" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`pk-${key}`}>Type</label>
          <select id={`pk-${key}`} className="inp" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
            <option value="DEVELOPER">Property developer</option>
            <option value="SOLAR">Solar provider</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
      <div className="two-up">
        <div className="field">
          <label htmlFor={`pu-${key}`}>Website (https://…)</label>
          <input id={`pu-${key}`} className="inp" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`pl-${key}`}>Logo</label>
          <ImageSelect id={`pl-${key}`} value={v.mediaAssetId} onChange={(x) => setV({ ...v, mediaAssetId: x })} images={images} />
        </div>
      </div>
      <label className="consent">
        <input type="checkbox" checked={v.published} onChange={(e) => setV({ ...v, published: e.target.checked })} /> Show on the website
      </label>
      <div className="rowacts">
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
          Save
        </button>
        {item && (
          <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => confirm(`Remove ${item.name}?`) && start(() => deletePartnerAction(item.id))}>
            Remove
          </button>
        )}
        {msg && <span role="status">{msg}</span>}
      </div>
    </form>
  );
}

export function PeopleManager({ team, partners, images }: { team: Team[]; partners: Partner[]; images: Img[] }) {
  return (
    <div className="editor-grid">
      <section>
        <h2 className="label" style={{ marginBottom: ".8rem" }}>
          Team
        </h2>
        {team.map((t) => (
          <TeamRow key={t.id} item={t} images={images} />
        ))}
        <TeamRow item={null} images={images} />
      </section>
      <section>
        <h2 className="label" style={{ marginBottom: ".8rem" }}>
          Partners
        </h2>
        {partners.map((p) => (
          <PartnerRow key={p.id} item={p} images={images} />
        ))}
        <PartnerRow item={null} images={images} />
      </section>
    </div>
  );
}
