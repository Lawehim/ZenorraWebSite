"use client";
import { useState } from "react";
import { postJson } from "./types";

export function NewsletterForm({ buttonLabel, note }: { buttonLabel: string; note?: string }) {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "err"; msg?: string }>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      const r = await postJson("/api/subscribe", { email, website: hp });
      setState(r.ok ? { kind: "ok", msg: "Check your inbox to confirm your subscription." } : { kind: "err", msg: r.message });
      if (r.ok) setEmail("");
    } catch {
      setState({ kind: "err", msg: "Couldn't subscribe — check your connection and try again." });
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="news">
        <label htmlFor="news-email" className="sr-only">
          Email address
        </label>
        <input id="news-email" type="email" autoComplete="email" placeholder="Your email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="hp" tabIndex={-1} aria-hidden="true" autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        <button type="submit" disabled={state.kind === "busy"}>
          {buttonLabel}
        </button>
      </div>
      <p role="status" aria-live="polite" style={{ fontSize: ".78rem", marginTop: ".6rem", color: state.kind === "err" ? "var(--warn)" : "var(--ink-3)" }}>
        {state.msg ?? note}
      </p>
    </form>
  );
}
