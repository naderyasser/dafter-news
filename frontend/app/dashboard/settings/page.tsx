import DashboardShell from "@/components/dashboard/DashboardShell";
import SettingsManager from "@/components/dashboard/SettingsManager";
import { getSiteSettings } from "@/lib/api";

export const revalidate = 0;

export default async function DashSettingsPage() {
  const settings = await getSiteSettings();
  return (
    <DashboardShell active="settings" breadcrumb="لوحة التحكم / النظام" title="الإعدادات">
      <SettingsManager initial={settings} />
    </DashboardShell>
  );
}
