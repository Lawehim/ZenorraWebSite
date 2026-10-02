"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { slugify } from "@/lib/slug";
import { readingMinutes } from "@/lib/format";
import { savePostAction, addCategoryAction } from "@/server/actions/posts";
import { Field } from "@/components/ui/Field";
import { MediaPickerInput } from "./MediaPickerInput";
import { useDraftRecovery } from "./useDraftRecovery";

const RichTextEditor = dynamic(() => import("./RichTextEditor").then((m) => m.RichTextEditor), { ssr: false, loading: () => <div className="rte" aria-busy="true" /> });

export interface PostDraft {
  title: string;
  slug: string;
  excerpt: string;
  bodyHtml: string;
  categoryId: string;
  authorName: string;
  coverUrl: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
  publishedAt: string; // datetime-local in Lagos time
  readingMinutes: string;
  seoTitle: string;
  seoDescription: string;
}

export function PostEditor({ id, initial, categories, canPublish, coverAssets }: { id: string | null; initial: PostDraft; categories: { id: string; name: string }[]; canPublish: boolean; coverAssets: Record<string, string> }) {
  const router = useRouter();
  const [d, setD] = useState<PostDraft>(initial);
  const [cats, setCats] = useState(categories);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const recovery = useDraftRecovery(`post:${id ?? "new"}`, d, initial);
  const set = <K extends keyof PostDraft>(k: K, v: PostDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const autoSlug = useMemo(() => slugify(d.title || "untitled"), [d.title]);
  const minutes = useMemo(() => readingMinutes(d.bodyHtml), [d.bodyHtml]);

  async function save(nextStatus?: PostDraft["status"]) {
    setSaving(true);
    setStatus(null);
    const st = nextStatus ?? d.status;
    const coverMediaId = d.coverUrl ? coverAssets[d.coverUrl.replace(/^\/media\//, "")] ?? "" : "";
    try {
      const r = await savePostAction(id, {
        ...d,
        status: st,
        slug: d.slug,
        coverMediaId,
        publishedAt: d.publishedAt ? new Date(`${d.publishedAt}:00+01:00`).toISOString() : "",
        readingMinutes: d.readingMinutes,
      });
      if (r.ok) {
        setErrors({});
        recovery.clear();
        setD((x) => ({ ...x, status: st, slug: r.slug }));
        setStatus(st === "PUBLISHED" ? "Published. Live on the site within a minute." : st === "SCHEDULED" ? "Scheduled. It will go live automatically." : "Draft saved.");
        if (!id) router.replace(`/admin/posts/${r.id}`);
        else router.refresh();
      } else {
        setErrors(r.errors);
        setStatus("Fix the highlighted fields.");
      }
    } catch {
      setStatus("Couldn't reach the server. Your draft is kept on this device — try again.");
    } finally {
      setSaving(false);
    }
  }

  const titleWarn = (d.seoTitle || d.title).length > 60 ? "Over 60 characters — search engines may cut it off." : undefined;
  const descWarn = (d.seoDescription || d.excerpt).length > 155 ? "Over 155 characters — search engines may cut it off." : undefined;

  return (
    <div className="editor-grid">
      <div>
        {recovery.available && (
          <div className="form-ok" role="status" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <span>Unsaved work from an earlier session was found.</span>
            <button type="button" className="btn btn-line btn-sm" onClick={() => setD(recovery.restore() as PostDraft)}>
              Recover it
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={recovery.clear}>
              Discard
            </button>
          </div>
        )}
        <Field label="Headline" error={errors.title}>
          {(p) => <input {...p} className="inp" value={d.title} onChange={(e) => set("title", e.target.value)} style={{ fontSize: "1.2rem" }} />}
        </Field>
        <Field label="Excerpt" help="One or two sentences shown on cards and in search results.">
          {(p) => <textarea {...p} className="inp" rows={3} maxLength={400} value={d.excerpt} onChange={(e) => set("excerpt", e.target.value)} />}
        </Field>
        <div className="field">
          <span className="label" id="body-label">
            Body
          </span>
          <RichTextEditor value={d.bodyHtml} onChange={(h) => set("bodyHtml", h)} labelledBy="body-label" />
          <span className="help">About {minutes} min read · images need alt text · pasted formatting is cleaned automatically</span>
        </div>
      </div>
      <aside>
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2>Publish</h2>
          <Field label="Status">
            {(p) => (
              <select {...p} className="inp" value={d.status} onChange={(e) => set("status", e.target.value as PostDraft["status"])} disabled={!canPublish}>
                <option value="DRAFT">Draft</option>
                {canPublish && <option value="SCHEDULED">Scheduled</option>}
                {canPublish && <option value="PUBLISHED">Published</option>}
                <option value="ARCHIVED">Archived</option>
              </select>
            )}
          </Field>
          <Field label="Publish date & time (WAT)" error={errors.publishedAt} help="Leave empty to publish now. A future time schedules it.">
            {(p) => <input {...p} className="inp" type="datetime-local" value={d.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} />}
          </Field>
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-line btn-sm" disabled={saving} onClick={() => save("DRAFT")}>
              Save draft
            </button>
            {canPublish && (
              <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={() => save(d.publishedAt && new Date(`${d.publishedAt}:00+01:00`) > new Date() ? "SCHEDULED" : "PUBLISHED")}>
                {d.publishedAt && new Date(`${d.publishedAt}:00+01:00`) > new Date() ? "Schedule" : "Publish"}
              </button>
            )}
            {id && (
              <a className="btn btn-ghost btn-sm" href={`/preview/posts/${id}`} target="_blank" rel="noopener noreferrer">
                Preview
              </a>
            )}
          </div>
          <p role="status" aria-live="polite" style={{ fontSize: ".84rem", marginTop: ".8rem", color: Object.keys(errors).length ? "var(--warn)" : "var(--ok)" }}>
            {status}
          </p>
        </div>
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h2>Details</h2>
          <Field label="Category">
            {(p) => (
              <select
                {...p}
                className="inp"
                value={d.categoryId}
                onChange={async (e) => {
                  if (e.target.value === "__new") {
                    const name = prompt("New category name");
                    const c = name ? await addCategoryAction(name) : null;
                    if (c) {
                      setCats((x) => [...x.filter((y) => y.id !== c.id), c]);
                      set("categoryId", c.id);
                    }
                  } else set("categoryId", e.target.value);
                }}
              >
                <option value="">None</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="__new">+ New category…</option>
              </select>
            )}
          </Field>
          <Field label="Author shown" help="Defaults to “Zenorra Advisory”.">
            {(p) => <input {...p} className="inp" value={d.authorName} onChange={(e) => set("authorName", e.target.value)} />}
          </Field>
          <Field label="Cover image">{(p) => <MediaPickerInput {...p} label="Cover image" value={d.coverUrl} onChange={(v) => set("coverUrl", v)} />}</Field>
          <Field label="Web address" help={`/insights/${d.slug || autoSlug}`} error={errors.slug}>
            {(p) => <input {...p} className="inp" value={d.slug} placeholder={autoSlug} onChange={(e) => set("slug", e.target.value)} />}
          </Field>
          <Field label="Reading time override (minutes)" help={`Calculated: ${minutes} min`}>
            {(p) => <input {...p} className="inp" type="number" min={1} max={120} value={d.readingMinutes} onChange={(e) => set("readingMinutes", e.target.value)} />}
          </Field>
        </div>
        <div className="card">
          <h2>Search & sharing</h2>
          <Field label="SEO title" help={titleWarn ?? `${(d.seoTitle || d.title).length}/60`}>
            {(p) => <input {...p} className="inp" value={d.seoTitle} placeholder={d.title} onChange={(e) => set("seoTitle", e.target.value)} />}
          </Field>
          <Field label="SEO description" help={descWarn ?? `${(d.seoDescription || d.excerpt).length}/155`}>
            {(p) => <textarea {...p} className="inp" rows={3} value={d.seoDescription} placeholder={d.excerpt} onChange={(e) => set("seoDescription", e.target.value)} />}
          </Field>
        </div>
      </aside>
    </div>
  );
}
