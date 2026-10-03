"use client";
// Defers the chat bundle until the browser is idle so it never competes with page load (FR-CHAT-004).
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

export function LazyChat() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 });
    else setTimeout(go, 2500);
  }, []);
  return ready ? <ChatWidget /> : null;
}
