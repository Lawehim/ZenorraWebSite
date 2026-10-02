"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-render the server page periodically while the tab is visible (chat inbox). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
