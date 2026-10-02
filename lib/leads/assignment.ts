// Round-robin assignment and first-response SLA (FR-ADM-041/042).
export function nextAdvisor(advisorIds: string[], lastAssignedId: string | null): string | null {
  if (!advisorIds.length) return null;
  const i = lastAssignedId ? advisorIds.indexOf(lastAssignedId) : -1;
  return advisorIds[(i + 1) % advisorIds.length];
}

export function slaDueAt(createdAt: Date, hours: number): Date {
  return new Date(createdAt.getTime() + hours * 3600_000);
}
