import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/server/auth/session";
import { getBlockDef, resolveBlock, type ContentKey } from "@/lib/content/registry";
import { getStoredContent } from "@/server/services/content";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const metadata = { title: "Edit content" };

export default async function EditContent({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await requirePageUser("content.edit", `/admin/content/${key}`);
  const def = getBlockDef(key);
  if (!def) notFound();
  const row = await getStoredContent(key);
  const value = resolveBlock(key as ContentKey, row?.data) as Record<string, unknown>;
  return (
    <>
      <div className="adm-head">
        <div>
          <p className="mono" style={{ fontSize: ".66rem", letterSpacing: ".16em", textTransform: "uppercase" }}>
            <Link href="/admin/content">Site content</Link> / {def.page}
          </p>
          <h1>{def.label}</h1>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 820 }}>
        <ContentEditor blockKey={key} value={value} hasOverride={Boolean(row)} />
      </div>
    </>
  );
}
