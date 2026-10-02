"use client";
// NDPA consent gate (FR-GLOB-007): no analytics or marketing pixel before an affirmative choice.
import { useEffect, useState } from "react";

const KEY = "zn.consent";
export const CONSENT_VERSION = "2026-10-v1";

export interface ConsentChoice {
  analytics: boolean;
  marketing: boolean;
  version: string;
  at: string;
}

export function readConsent(): ConsentChoice | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as ConsentChoice | null;
    return c?.version === CONSENT_VERSION ? c : null;
  } catch {
    return null;
  }
}

function writeConsent(c: Omit<ConsentChoice, "version" | "at">) {
  const full = { ...c, version: CONSENT_VERSION, at: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(full));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("zn:consent", { detail: full }));
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Consent lives in browser storage, readable only after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!readConsent()) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener("zn:consent-open", reopen);
    return () => window.removeEventListener("zn:consent-open", reopen);
  }, []);

  if (!open) return null;
  const decide = (a: boolean, m: boolean) => {
    writeConsent({ analytics: a, marketing: m });
    setOpen(false);
  };
  return (
    <section className="cookie" aria-labelledby="cookie-h">
      <h2 id="cookie-h">Your privacy</h2>
      <p>
        We use essential cookies to run this site. With your permission we&apos;d also use analytics to improve it and marketing cookies to measure our campaigns.{" "}
        <a href="/legal/cookies" style={{ textDecoration: "underline" }}>
          Cookie policy
        </a>
      </p>
      {custom && (
        <div style={{ marginTop: ".8rem", display: "grid", gap: ".4rem" }}>
          <label className="consent">
            <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> Analytics (Google Analytics)
          </label>
          <label className="consent">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> Marketing (Meta Pixel)
          </label>
        </div>
      )}
      <div className="row">
        <button type="button" className="btn btn-gold btn-sm" onClick={() => decide(true, true)}>
          Accept all
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={() => decide(false, false)}>
          Essential only
        </button>
        {custom ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => decide(analytics, marketing)}>
            Save choices
          </button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustom(true)}>
            Choose
          </button>
        )}
      </div>
    </section>
  );
}

export function CookiePreferencesLink() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("zn:consent-open"))} style={{ font: "inherit", letterSpacing: "inherit", color: "inherit" }}>
      Cookie preferences
    </button>
  );
}
