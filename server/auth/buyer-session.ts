import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBuyerSession } from "@/server/services/buyer-auth";

export const BUYER_COOKIE = "zn_buyer";

export async function currentBuyer() {
  return getBuyerSession((await cookies()).get(BUYER_COOKIE)?.value);
}

export async function requireBuyer(next = "/account") {
  const b = await currentBuyer();
  if (!b) redirect(`/account/login?next=${encodeURIComponent(next)}`);
  return b;
}

export async function setBuyerCookie(token: string) {
  (await cookies()).set(BUYER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}
