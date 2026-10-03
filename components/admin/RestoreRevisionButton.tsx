"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreRevisionAction } from "@/server/actions/phase2";

export function RestoreRevisionButton({ revisionId }: { revisionId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Restore this version? The current text is kept in history.")) return;
        start(async () => {
          await restoreRevisionAction(revisionId);
          router.refresh();
        });
      }}
    >
      Restore
    </button>
  );
}
