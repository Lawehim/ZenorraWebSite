import { NextResponse } from "next/server";
import { confirmSubscription } from "@/server/services/subscribers";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ok = await confirmSubscription(token);
  return NextResponse.redirect(new URL(`/newsletter?status=${ok ? "confirmed" : "expired"}`, req.url), 303);
}
