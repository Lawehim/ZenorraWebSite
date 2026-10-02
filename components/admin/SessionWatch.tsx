"use client";
// Warns 2 minutes before the session ends (FR-ADM-004). Drafts are already mirrored locally.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SessionWatch({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    const end = new Date(expiresAt).getTime();
    const t = setInterval(() => setLeft(Math.round((end - Date.now()) / 1000)), 5000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left === null || left > 120) return null;
  return (
    <div className="toast" role="alert">
      {left > 0 ? (
        <>
          Your session ends in about {Math.max(1, Math.round(left / 60))} minute(s). Unsaved drafts are kept on this device.
          <button className="btn btn-line btn-sm" onClick={() => router.refresh()}>
            Stay signed in
          </button>
        </>
      ) : (
        <>
          Your session has ended.
          <a className="btn btn-line btn-sm" href={`/admin/login?next=${encodeURIComponent(location.pathname)}`}>
            Sign in again
          </a>
        </>
      )}
    </div>
  );
}
