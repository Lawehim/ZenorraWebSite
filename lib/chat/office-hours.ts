// Live-chat availability from the settings record, evaluated in Africa/Lagos (FR-CHAT-001).
export interface OfficeHours {
  days: number[]; // 0 = Sunday … 6 = Saturday
  open: string; // "09:00"
  close: string; // "18:00"
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function lagosParts(d: Date) {
  // WAT is UTC+1 all year (no daylight saving).
  const l = new Date(d.getTime() + 3600_000);
  return { day: l.getUTCDay(), minutes: l.getUTCHours() * 60 + l.getUTCMinutes() };
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function officeStatus(hours: OfficeHours, now: Date = new Date()): { online: boolean; nextOpen: string | null } {
  const { day, minutes } = lagosParts(now);
  const open = toMinutes(hours.open);
  const close = toMinutes(hours.close);
  if (hours.days.includes(day) && minutes >= open && minutes < close) return { online: true, nextOpen: null };
  if (hours.days.includes(day) && minutes < open) return { online: false, nextOpen: `Today at ${hours.open}` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (hours.days.includes(d)) return { online: false, nextOpen: `${i === 1 ? "Tomorrow" : WEEKDAYS[d]} at ${hours.open}` };
  }
  return { online: false, nextOpen: null };
}
