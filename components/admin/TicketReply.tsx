"use client";
import { useState, useTransition } from "react";
import { replyTicketAction, closeTicketAction } from "@/server/actions/phase3";

export function TicketReply({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) start(async () => void (await replyTicketAction(id, text), setText("")));
      }}
    >
      <div className="field">
        <label htmlFor={`tr-${id}`}>Reply to buyer</label>
        <textarea id={`tr-${id}`} className="inp" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="rowacts">
        <button className="btn btn-gold btn-sm" type="submit" disabled={pending || !text.trim()}>
          Send reply
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(() => closeTicketAction(id))}>
          Close ticket
        </button>
      </div>
    </form>
  );
}
