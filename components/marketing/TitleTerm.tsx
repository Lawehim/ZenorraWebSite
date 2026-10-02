// Title terms link to a plain-language explanation on first use (NFR-USE-005, US-BUY-07).
import type { TitleType } from "@prisma/client";

export const TITLE_GLOSSARY: Record<TitleType, string> = {
  C_OF_O: "Certificate of Occupancy — a leasehold interest (usually 99 years) granted by the state governor. The strongest title routinely held.",
  GOVERNORS_CONSENT: "Governor's Consent — the governor's approval of a transfer of land that already has a C of O. Needed for a complete resale.",
  EXCISION: "Excision — the state's formal release of land from government acquisition back to the original community, making it legitimately sellable.",
  GAZETTE: "Gazette — the government's published record of an excision, with a volume and page reference you can check.",
  REGISTERED_SURVEY: "Registered Survey — a survey plan lodged with the Surveyor-General. It proves where the parcel is, not that the seller may sell it.",
  EXCISION_IN_PROGRESS: "Excision in progress — the community has applied for excision; it has not yet been granted or gazetted.",
  OTHER: "Ask an advisor for the exact title document and its reference before paying.",
};

export function TitleTerm({ type, label }: { type: TitleType; label: string }) {
  return (
    <details>
      <summary className="gloss" style={{ listStyle: "none", display: "inline" }}>
        {label}
        <span className="sr-only"> — what does this mean?</span>
      </summary>
      <p style={{ fontSize: ".82rem", color: "var(--ink-2)", marginTop: ".5rem" }}>{TITLE_GLOSSARY[type]}</p>
    </details>
  );
}
