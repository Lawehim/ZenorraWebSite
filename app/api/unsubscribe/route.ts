import { NextResponse } from "next/server";
import { unsubscribe } from "@/server/services/subscribers";

// One-click unsubscribe (FR-NOTIF-008, RFC 8058 POST also supported).
async function handle(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await unsubscribe(token);
  return NextResponse.redirect(new URL(`/newsletter?status=${ok ? "unsubscribed" : "invalid"}`, req.url), 303);
}

export const GET = handle;
export const POST = handle;
