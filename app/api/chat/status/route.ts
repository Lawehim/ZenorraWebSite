import { getSettings } from "@/server/services/settings";
import { officeStatus } from "@/lib/chat/office-hours";

export async function GET() {
  const s = await getSettings();
  return Response.json(officeStatus(s.officeHours), { headers: { "Cache-Control": "no-store" } });
}
