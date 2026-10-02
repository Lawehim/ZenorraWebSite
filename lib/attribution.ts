// First- and last-touch attribution captured client-side (FR-ANL-004) and sent with every form.
const KEY = "zn.attr";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

export interface Attribution {
  utm?: Record<string, string>;
  landingPath?: string;
  referrer?: string;
}

function safeGet(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: () => Storage, key: string, value: string) {
  try {
    store().setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — degrade silently */
  }
}

export function captureAttribution(loc: { pathname: string; search: string }, referrer: string) {
  const params = new URLSearchParams(loc.search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) utm[k] = v.slice(0, 200);
  }
  const existing = readAttribution();
  if (!existing.landingPath) {
    const first: Attribution = { utm: Object.keys(utm).length ? utm : undefined, landingPath: (loc.pathname + loc.search).slice(0, 300), referrer: referrer.slice(0, 500) || undefined };
    safeSet(() => sessionStorage, KEY, JSON.stringify(first));
  } else if (Object.keys(utm).length) {
    // last touch: a new campaign arrival overrides the UTM set but keeps the landing page
    safeSet(() => sessionStorage, KEY, JSON.stringify({ ...existing, utm: { ...utm, first_source: existing.utm?.utm_source ?? "" } }));
  }
}

export function readAttribution(): Attribution {
  const raw = safeGet(() => sessionStorage, KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Attribution;
  } catch {
    return {};
  }
}

export function formContext(): Attribution & { pagePath: string; idempotencyKey: string } {
  const a = readAttribution();
  const key = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
  return { ...a, pagePath: typeof location !== "undefined" ? location.pathname : "", idempotencyKey: key };
}
