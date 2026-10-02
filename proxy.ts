// Next.js 16 request proxy (formerly middleware): cheap cookie gate for /admin so
// signed-out deep links go to sign-in with their destination preserved (FR-ADM-001, TC-ADM-004).
// Full session validation happens server-side in the admin layout and every action.
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const open = pathname === "/admin/login" || pathname.startsWith("/admin/accept-invite");
  const res = NextResponse.next({ request: { headers: new Headers({ ...Object.fromEntries(req.headers), "x-zn-path": pathname + search }) } });
  if (open) return res;
  if (!req.cookies.get("zn_admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/admin/:path*", "/preview/:path*"] };
