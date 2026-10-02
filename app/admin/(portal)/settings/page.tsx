import { requirePageUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePageUser("settings.edit", "/admin/settings");
  const s = await getSettings();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Site settings</h1>
          <p>Contact details, social links and inspection logistics. Changes update the footer, contact page, WhatsApp links and structured data everywhere within a minute.</p>
        </div>
      </div>
      <SettingsForm initial={s} />
    </>
  );
}
