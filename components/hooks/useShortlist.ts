"use client";
// Anonymous shortlist in localStorage (FR-PROP-019); merged into the buyer account on sign-in.
import { useCallback, useSyncExternalStore } from "react";

const KEY = "zn.shortlist";
const MAX = 30;
const EVENT = "zn:shortlist";

export function readShortlist(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable — shortlist degrades silently (TC-EDGE-031) */
  }
  window.dispatchEvent(new Event(EVENT));
}

let cache = "";
let cached: string[] = [];
function snapshot() {
  const raw = (() => {
    try {
      return localStorage.getItem(KEY) ?? "[]";
    } catch {
      return "[]";
    }
  })();
  if (raw !== cache) {
    cache = raw;
    cached = readShortlist();
  }
  return cached;
}
const EMPTY: string[] = [];

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useShortlist() {
  const list = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const toggle = useCallback((slug: string) => {
    const cur = readShortlist();
    write(cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur]);
  }, []);
  const clear = useCallback(() => write([]), []);
  return { list, toggle, clear, has: (slug: string) => list.includes(slug) };
}
