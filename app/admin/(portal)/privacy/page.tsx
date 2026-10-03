import { requirePageUser } from "@/server/auth/session";
import { can } from "@/lib/rbac";
import { DsrTool } from "@/components/admin/DsrTool";

export const metadata = { title: "Privacy requests" };

export default async function Privacy() {
  const user = await requirePageUser("leads.export", "/admin/privacy");
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Privacy requests</h1>
          <p>Handle NDPA data subject requests: find everything held about a person by phone or email, export it, or erase it. Respond within 30 days. Every search, export and erasure is audited.</p>
        </div>
      </div>
      <DsrTool canErase={can(user.role, "dsr.erase")} />
    </>
  );
}
