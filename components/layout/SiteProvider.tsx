"use client";
// Holds the site-wide pop-ups (advisor, inspection booking) so any CTA can open them
// without navigation (FR-GLOB-001), and wires attribution capture + scroll reveals.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ContentOf } from "@/lib/content/registry";
import { captureAttribution, captureReferral } from "@/lib/attribution";
import { CORRIDORS } from "@/lib/properties/filters";
import { Modal } from "@/components/ui/Modal";
import { AdvisorWizard } from "@/components/forms/AdvisorWizard";
import { BookingForm } from "@/components/forms/BookingForm";
import { postJson } from "@/components/forms/types";

interface Ctx {
  openAdvisor: (propertySlug?: string) => void;
  openBooking: (propertySlug?: string) => void;
}

const SiteCtx = createContext<Ctx>({ openAdvisor: () => {}, openBooking: () => {} });
export const useSite = () => useContext(SiteCtx);

export interface SiteProviderProps {
  advisorCopy: ContentOf<"site.advisor">;
  bookingCopy: ContentOf<"site.booking">;
  properties: { slug: string; name: string }[];
  departurePoints: string[];
  inspectionDates: string[];
  children: ReactNode;
}

export function SiteProvider({ advisorCopy, bookingCopy, properties, departurePoints, inspectionDates, children }: SiteProviderProps) {
  const [modal, setModal] = useState<{ kind: "advisor" | "booking"; slug?: string } | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    captureAttribution(window.location, document.referrer);
    captureReferral(window.location.search);
  }, [pathname]);

  // Offline support (FR-GLOB-009) — production builds only, so development never serves stale pages.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  // Progressive reveal: only hide content once JS is running.
  useEffect(() => {
    document.documentElement.classList.add("js");
    const els = Array.from(document.querySelectorAll(".rv:not(.in)"));
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [pathname]);

  const openAdvisor = useCallback((slug?: string) => setModal({ kind: "advisor", slug }), []);
  const openBooking = useCallback((slug?: string) => setModal({ kind: "booking", slug }), []);
  const close = useCallback(() => setModal(null), []);

  return (
    <SiteCtx.Provider value={{ openAdvisor, openBooking }}>
      {children}
      <Modal open={modal?.kind === "advisor"} onClose={close} title={advisorCopy.title} description={advisorCopy.intro}>
        <AdvisorWizard copy={advisorCopy} corridors={[...CORRIDORS]} propertySlug={modal?.slug} onSubmit={(p) => postJson("/api/leads", p)} />
      </Modal>
      <Modal open={modal?.kind === "booking"} onClose={close} title={bookingCopy.title} description={bookingCopy.intro}>
        <BookingForm copy={bookingCopy} properties={properties} departurePoints={departurePoints} dates={inspectionDates} initialProperty={modal?.slug} onSubmit={(p) => postJson("/api/bookings", p)} />
      </Modal>
    </SiteCtx.Provider>
  );
}

/** A button that opens one of the site pop-ups. Usable from server components. */
export function OpenModalButton({ kind, propertySlug, className = "btn btn-line", children }: { kind: "advisor" | "booking"; propertySlug?: string; className?: string; children: ReactNode }) {
  const { openAdvisor, openBooking } = useSite();
  return (
    <button type="button" className={className} onClick={() => (kind === "advisor" ? openAdvisor(propertySlug) : openBooking(propertySlug))}>
      {children}
    </button>
  );
}
