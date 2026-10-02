"use client";
// Merges the device's anonymous shortlist into the buyer account once per session (FR-PORT-009).
import { useEffect } from "react";
import { readShortlist } from "@/components/hooks/useShortlist";
import { mergeShortlistAction } from "@/server/actions/account";

export function ShortlistSync() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("zn.shortlist.synced")) return;
      const slugs = readShortlist();
      if (slugs.length) mergeShortlistAction(slugs).then(() => sessionStorage.setItem("zn.shortlist.synced", "1"));
    } catch {
      /* storage unavailable */
    }
  }, []);
  return null;
}
