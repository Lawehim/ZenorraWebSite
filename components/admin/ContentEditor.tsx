"use client";
import { useRouter } from "next/navigation";
import { getBlockDef } from "@/lib/content/registry";
import { saveContentAction, resetContentAction } from "@/server/actions/content";
import { ContentBlockForm } from "./ContentBlockForm";

/** Binds the generic form to the server actions. The block definition is resolved client-side by key. */
export function ContentEditor({ blockKey, value, hasOverride }: { blockKey: string; value: Record<string, unknown>; hasOverride: boolean }) {
  const router = useRouter();
  const def = getBlockDef(blockKey)!;
  return (
    <ContentBlockForm
      def={def}
      value={value}
      onSave={async (data) => {
        const r = await saveContentAction(blockKey, data);
        if (r.ok) router.refresh();
        return r;
      }}
      onReset={
        hasOverride
          ? async () => {
              if (!confirm("Restore the original text for this section? Your edits will be replaced.")) return;
              await resetContentAction(blockKey);
              router.refresh();
            }
          : undefined
      }
    />
  );
}
