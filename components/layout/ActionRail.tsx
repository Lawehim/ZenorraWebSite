"use client";
import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { SocialIcon, Icon } from "@/components/ui/Icon";
import { useSite } from "./SiteProvider";

/** Floating WhatsApp + inspection controls (FR-GLOB-005, FR-LEAD-011). */
export function ActionRail({ whatsappNumber, whatsappLabel, inspectLabel, defaultMessage }: { whatsappNumber: string; whatsappLabel: string; inspectLabel: string; defaultMessage: string }) {
  const pathname = usePathname();
  const { openBooking } = useSite();
  const propertySlug = pathname.startsWith("/properties/") ? pathname.split("/")[2] : undefined;

  function message() {
    if (typeof document === "undefined") return defaultMessage;
    const ref = document.querySelector<HTMLElement>("[data-property-ref]");
    return ref ? `Hello Zenorra, I'm interested in ${ref.dataset.propertyName} (${ref.dataset.propertyRef}). ${location.href}` : `${defaultMessage} (${pathname})`;
  }

  return (
    <div className="rail">
      <a
        className="fab wa"
        href={whatsappLink(whatsappNumber, defaultMessage)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.currentTarget.href = whatsappLink(whatsappNumber, message());
        }}
      >
        <SocialIcon name="whatsapp" size={17} />
        <span>{whatsappLabel}</span>
        <span className="sr-only"> (opens WhatsApp)</span>
      </a>
      <button type="button" className="fab" onClick={() => openBooking(propertySlug)} aria-label={inspectLabel}>
        <Icon name="calendar" />
        <span>{inspectLabel}</span>
      </button>
    </div>
  );
}
