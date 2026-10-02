import { requirePageUser } from "@/server/auth/session";
import { newTotpSecret, totpUri, requiresTwoFactor } from "@/server/services/auth";
import { ROLE_LABELS } from "@/lib/rbac";
import { AccountForms } from "@/components/admin/AccountForms";

export const metadata = { title: "My account" };

export default async function Account() {
  const user = await requirePageUser("dashboard.view", "/admin/account");
  const secret = user.twoFactorEnabled ? null : newTotpSecret();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>My account</h1>
          <p>
            {user.name} · {user.email} · {ROLE_LABELS[user.role]}
          </p>
        </div>
      </div>
      <AccountForms twoFactorEnabled={user.twoFactorEnabled} required={requiresTwoFactor(user.role)} secret={secret} uri={secret ? totpUri(user.email, secret) : null} />
    </>
  );
}
