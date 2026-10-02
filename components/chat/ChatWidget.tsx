"use client";
// Built-in live chat (FR-CHAT-001..005). The launcher is tiny; the panel only talks to our
// own API, sets no cookies, and polls only while open.
import { useCallback, useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";

interface Msg {
  id: string;
  sender: string;
  body: string;
  createdAt: string;
}

const TOKEN_KEY = "zn.chat";

function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{ online: boolean; nextOpen: string | null } | null>(null);
  // The widget only renders in the browser (dynamic, ssr:false), so session storage is readable at init.
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [who, setWho] = useState({ name: "", contact: "" });
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || status) return;
    fetch("/api/chat/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ online: false, nextOpen: null }));
  }, [open, status]);

  const poll = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`/api/chat/messages?token=${encodeURIComponent(token)}`);
      if (r.ok) setMessages(((await r.json()) as { messages: Msg[] }).messages);
      else if (r.status === 404 || r.status === 410) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    } catch {
      /* offline — try again next tick */
    }
  }, [token]);

  useEffect(() => {
    if (!open || !token) return;
    // Polling our own chat endpoint is an external-system sync; one immediate fetch is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [open, token, poll]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setError(null);
    try {
      let t = token;
      if (!t) {
        if (!status?.online && !who.contact.trim()) {
          setError("Add a phone number or email so we can reply.");
          return;
        }
        const r = await fetch("/api/chat/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...who, pagePath: location.pathname }) });
        if (!r.ok) throw new Error();
        t = ((await r.json()) as { token: string }).token;
        try {
          sessionStorage.setItem(TOKEN_KEY, t);
        } catch {
          /* ignore */
        }
        setToken(t);
      }
      const r = await fetch("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, body, offline: !status?.online }) });
      if (!r.ok) throw new Error();
      setDraft("");
      setMessages((m) => [...m, { id: `local-${Date.now()}`, sender: "VISITOR", body, createdAt: new Date().toISOString() }]);
    } catch {
      setError("Message not sent — check your connection and try again.");
    }
  }

  return (
    <>
      <button type="button" className="fab chat-fab" aria-expanded={open} aria-controls="chat-panel" onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
        <span>Chat with us</span>
      </button>
      {open && (
        <section id="chat-panel" className="chat-panel" aria-label="Live chat">
          <header>
            <strong>Zenorra advisors</strong>
            <span className={`dot ${status?.online ? "on" : ""}`} aria-hidden="true" />
            <span className="muted" style={{ fontSize: ".78rem" }}>
              {status === null ? "Checking…" : status.online ? "Online now" : "Offline"}
            </span>
            <button type="button" className="modal-x" aria-label="Close chat" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <div className="chat-list" ref={listRef} aria-live="polite">
            {status && !status.online && !messages.length && (
              <p className="chat-note">
                We&apos;re offline right now{status.nextOpen ? ` — back ${status.nextOpen}` : ""}. Leave a message with your phone or email and an advisor will reply when we open.
              </p>
            )}
            {status?.online && !messages.length && <p className="chat-note">Ask anything about an estate, titles, payment plans or solar. An advisor will reply here.</p>}
            {messages.map((m) => (
              <p key={m.id} className={`bubble ${m.sender === "VISITOR" ? "me" : "them"}`}>
                <span className="sr-only">{m.sender === "VISITOR" ? "You: " : "Zenorra: "}</span>
                {m.body}
              </p>
            ))}
          </div>
          <form onSubmit={send} className="chat-form">
            {!token && (
              <div className="two-up">
                <Field label="Your name">{(p) => <input {...p} className="inp" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} autoComplete="name" />}</Field>
                <Field label={status?.online ? "Phone or email (optional)" : "Phone or email"}>{(p) => <input {...p} className="inp" value={who.contact} onChange={(e) => setWho({ ...who, contact: e.target.value })} autoComplete="tel" />}</Field>
              </div>
            )}
            <label htmlFor="chat-msg" className="sr-only">
              Message
            </label>
            <textarea id="chat-msg" className="inp" rows={2} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your message" />
            {error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-gold btn-sm" type="submit">
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
