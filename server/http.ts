// Helpers for route handlers: request context, same-origin check (NFR-SEC-007), JSON responses.
import { NextResponse } from "next/server";
import type { RequestCtx } from "@/server/services/actor";

export function requestCtx(req: Request): RequestCtx {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return { ip, userAgent: req.headers.get("user-agent") ?? undefined, now: new Date() };
}

/** Reject cross-site form posts: Origin (or Referer) must match the request host. */
export function sameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (text.length > 64_000) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const FORBIDDEN_ORIGIN = { ok: false, message: "This form must be submitted from the Zenorra website." };
export const BAD_JSON = { ok: false, message: "We couldn't read that submission. Please try again." };
export const SERVER_ERROR = { ok: false, message: "Something went wrong on our side. Your details are still in the form — please try again, or call us." };
