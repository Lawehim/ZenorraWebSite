"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deletePostAction, restorePostAction, duplicatePostAction } from "@/server/actions/posts";

export function PostRowActions({ id, slug, deleted, canDelete }: { id: string; slug: string; deleted: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="rowacts">
      {deleted ? (
        canDelete && (
          <button className="btn btn-line btn-sm" disabled={pending} onClick={() => start(() => restorePostAction(id))}>
            Restore
          </button>
        )
      ) : (
        <>
          <a className="btn btn-ghost btn-sm" href={`/preview/posts/${id}`} target="_blank" rel="noopener noreferrer">
            Preview<span className="sr-only"> {slug}</span>
          </a>
          <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => router.push(`/admin/posts/${await duplicatePostAction(id)}`))}>
            Duplicate
          </button>
          {canDelete && (
            <button
              className="btn btn-danger btn-sm"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this article? You can restore it from Recently deleted for 30 days.")) start(() => deletePostAction(id));
              }}
            >
              Delete
            </button>
          )}
        </>
      )}
    </div>
  );
}
