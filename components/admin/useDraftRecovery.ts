"use client";
// Editors never lose work to a power cut or dropped session (FR-ADM-006, C-2):
// the draft is mirrored to localStorage every 20s and offered back on return.
import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "zn.draft:";
const INTERVAL = 20_000;

export function useDraftRecovery<T>(key: string, current: T, saved: T) {
  const [stored, setStored] = useState<T | null>(null);
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        // Reading browser storage is only possible after mount; one extra render is intended.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (JSON.stringify(parsed) !== JSON.stringify(saved)) setStored(parsed);
      }
    } catch {
      /* storage unavailable */
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const write = () => {
      try {
        if (JSON.stringify(latest.current) !== JSON.stringify(saved)) localStorage.setItem(PREFIX + key, JSON.stringify(latest.current));
      } catch {
        /* ignore */
      }
    };
    const t = setInterval(write, INTERVAL);
    window.addEventListener("beforeunload", write);
    return () => {
      clearInterval(t);
      window.removeEventListener("beforeunload", write);
    };
  }, [key, saved]);

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
    setStored(null);
  }, [key]);

  const restore = useCallback(() => {
    const s = stored;
    setStored(null);
    return s;
  }, [stored]);

  return { available: stored !== null, restore, clear };
}
