const LABELS: Record<string, { label: string; tone: "live" | "draft" | "new" | "" }> = {
  NEW: { label: "New", tone: "new" },
  CONTACTED: { label: "Contacted", tone: "" },
  BOOKED_INSPECTION: { label: "Booked inspection", tone: "live" },
  NEGOTIATING: { label: "Negotiating", tone: "new" },
  CLOSED_WON: { label: "Closed — won", tone: "live" },
  CLOSED_LOST: { label: "Closed — lost", tone: "draft" },
  DRAFT: { label: "Draft", tone: "draft" },
  SCHEDULED: { label: "Scheduled", tone: "new" },
  PUBLISHED: { label: "Published", tone: "live" },
  ARCHIVED: { label: "Archived", tone: "" },
  SOLD_OUT: { label: "Sold out", tone: "draft" },
  PENDING: { label: "Pending", tone: "new" },
  CONFIRMED: { label: "Confirmed", tone: "live" },
  CANCELLED: { label: "Cancelled", tone: "draft" },
  ATTENDED: { label: "Attended", tone: "live" },
  ACTIVE: { label: "Active", tone: "live" },
  INVITED: { label: "Invited", tone: "new" },
  SUSPENDED: { label: "Suspended", tone: "draft" },
  REMOVED: { label: "Removed", tone: "" },
  UNSUBSCRIBED: { label: "Unsubscribed", tone: "" },
  QUEUED: { label: "Queued", tone: "new" },
  SENT: { label: "Sent", tone: "live" },
  FAILED: { label: "Failed", tone: "draft" },
};

export function statusLabel(status: string) {
  return LABELS[status]?.label ?? status;
}

export function StatusPill({ status }: { status: string }) {
  const s = LABELS[status] ?? { label: status, tone: "" };
  return <span className={`pill ${s.tone}`.trim()}>{s.label}</span>;
}
