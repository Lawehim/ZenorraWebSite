import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { LoginForm } from "@/components/admin/LoginForm";
import "../admin.css";

export const metadata: Metadata = { title: "Sign in — Zenorra admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; welcome?: string }> }) {
  const sp = await searchParams;
  if (await currentUser()) redirect(sp.next?.startsWith("/admin") ? sp.next : "/admin");
  return (
    <main className="login">
      <div className="login-box">
        <img src="/brand/lockup.webp" alt="Zenorra" width={68} height={34} />
        <h1 style={{ fontSize: "1.5rem", marginBottom: ".4rem" }}>Admin portal</h1>
        <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1.6rem" }}>
          {sp.welcome ? "Your password is set. Sign in to continue." : "Sign in to manage the website, leads and inspections."}
        </p>
        <LoginForm next={sp.next ?? "/admin"} />
        <noscript>
          <p className="notice">Sign-in needs cookies and JavaScript enabled.</p>
        </noscript>
      </div>
    </main>
  );
}
