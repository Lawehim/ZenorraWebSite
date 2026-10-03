"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chatReplyAction, chatCloseAction, chatLinkAction } from "@/server/actions/phase2";

export function ChatReply({ threadId, open, linked }: { threadId: string; open: boolean; linked: boolean }) {
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open) return <p className="muted">This chat is closed.</p>;
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          start(async () => {
            await chatReplyAction(threadId, text);
            setText("");
            router.refresh();
          });
        }}
      >
        <div className="field">
          <label htmlFor="reply">Reply</label>
          <textarea id="reply" className="inp" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="rowacts">
          <button className="btn btn-gold btn-sm" type="submit" disabled={pending}>
            Send reply
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => void (await chatCloseAction(threadId), router.push("/admin/chat")))}>
            Close chat
          </button>
        </div>
      </form>
      {!linked && (
        <form
          style={{ marginTop: "1.2rem", display: "flex", gap: ".5rem", alignItems: "end", flexWrap: "wrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await chatLinkAction(threadId, ref);
              setMsg(r.ok ? "Linked to the lead." : r.message ?? "Not linked.");
              router.refresh();
            });
          }}
        >
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ref">Attach to lead (reference)</label>
            <input id="ref" className="inp" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ZN-2026-00001" />
          </div>
          <button className="btn btn-line btn-sm" type="submit">
            Attach
          </button>
          {msg && <span role="status">{msg}</span>}
        </form>
      )}
    </>
  );
}
