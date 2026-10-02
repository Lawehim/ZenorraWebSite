"use client";
import { useState, useTransition } from "react";
import { addLeadNoteAction } from "@/server/actions/leads";

export function LeadNoteForm({ id }: { id: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        start(async () => {
          await addLeadNoteAction(id, text);
          setText("");
        });
      }}
    >
      <div className="field">
        <label htmlFor="note">Add a note or call outcome</label>
        <textarea id="note" className="inp" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Called — wants Saturday inspection, prefers WhatsApp" />
      </div>
      <button className="btn btn-line btn-sm" type="submit" disabled={pending || !text.trim()}>
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
