"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut, acceptInvite, setPassword, enableTotp } from "@/server/services/auth";
import { SESSION_COOKIE, currentUser } from "@/server/auth/session";
import { ABSOLUTE_HOURS } from "@/server/services/auth";

export interface AuthState {
  message?: string;
  twoFactor?: boolean;
  email?: string;
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const h = await headers();
  const email = String(form.get("email") ?? "");
  const r = await signIn(email, String(form.get("password") ?? ""), { ip: h.get("x-forwarded-for")?.split(",")[0] ?? "local", userAgent: h.get("user-agent") ?? undefined }, String(form.get("totp") ?? "") || undefined);
  if (!r.ok) return { message: r.message, twoFactor: r.twoFactorRequired, email };
  (await cookies()).set(SESSION_COOKIE, r.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_HOURS * 3600,
  });
  redirect(safeNext(form.get("next")));
}

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await signOut(token);
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function acceptInviteAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const pw = String(form.get("password") ?? "");
  if (pw !== String(form.get("confirm") ?? "")) return { message: "The two passwords don't match." };
  const r = await acceptInvite(String(form.get("token") ?? ""), pw);
  if (!r.ok) return { message: r.message };
  redirect("/admin/login?welcome=1");
}

export async function changePasswordAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const u = await currentUser();
  if (!u) redirect("/admin/login");
  const pw = String(form.get("password") ?? "");
  if (pw !== String(form.get("confirm") ?? "")) return { message: "The two passwords don't match." };
  const r = await setPassword(u.id, pw);
  return { message: r.ok ? "Password updated." : r.message };
}

export async function enableTotpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const u = await currentUser();
  if (!u) redirect("/admin/login");
  const ok = await enableTotp(u.id, String(form.get("secret") ?? ""), String(form.get("code") ?? ""));
  return { message: ok ? "Two-factor authentication is on. You'll be asked for a code at each sign-in." : "That code didn't match. Check the time on your phone and try again." };
}
