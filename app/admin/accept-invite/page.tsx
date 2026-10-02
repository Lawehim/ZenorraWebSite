import type { Metadata } from "next";
import { AcceptInviteForm } from "@/components/admin/AcceptInviteForm";
import "../admin.css";

export const metadata: Metadata = { title: "Set your password — Zenorra admin", robots: { index: false, follow: false } };

export default async function AcceptInvite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="login">
      <div className="login-box">
        <img src="/brand/lockup.webp" alt="Zenorra" width={68} height={34} />
        <h1 style={{ fontSize: "1.5rem", marginBottom: ".4rem" }}>Welcome to the admin portal</h1>
        <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1.6rem" }}>
          Choose a password of at least 12 characters.
        </p>
        <AcceptInviteForm token={token ?? ""} />
      </div>
    </main>
  );
}
