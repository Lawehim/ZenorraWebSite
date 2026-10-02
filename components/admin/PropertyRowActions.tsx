"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PropertyStatus } from "@prisma/client";
import { setPropertyStatusAction, deletePropertyAction, restorePropertyAction, duplicatePropertyAction } from "@/server/actions/properties";

export function PropertyRowActions({ id, slug, status, deleted, canPublish }: { id: string; slug: string; status: PropertyStatus; deleted: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (deleted) {
    return canPublish ? (
      <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(() => restorePropertyAction(id))}>
        Restore
      </button>
    ) : null;
  }
  return (
    <div className="rowacts">
      {status === "PUBLISHED" || status === "SOLD_OUT" ? (
        <a className="btn btn-ghost btn-sm" href={`/properties/${slug}`} target="_blank" rel="noopener noreferrer">
          View ↗
        </a>
      ) : null}
      {canPublish && status !== "PUBLISHED" && (
        <button className="btn btn-gold btn-sm" disabled={pending} onClick={() => start(() => setPropertyStatusAction(id, "PUBLISHED"))}>
          Publish
        </button>
      )}
      {canPublish && status === "PUBLISHED" && (
        <>
          <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(() => setPropertyStatusAction(id, "SOLD_OUT"))}>
            Mark sold out
          </button>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => setPropertyStatusAction(id, "DRAFT"))}>
            Unpublish
          </button>
        </>
      )}
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => router.push(`/admin/properties/${await duplicatePropertyAction(id)}`))}>
        Duplicate
      </button>
      {canPublish && (
        <button
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this property? Its page will show as withdrawn. You can restore it for 30 days.")) start(() => deletePropertyAction(id));
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}
