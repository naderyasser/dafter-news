import DashboardShell from "@/components/dashboard/DashboardShell";
import { requireCapability } from "@/lib/dashboardAccess";
import SettingsManager from "@/components/dashboard/SettingsManager";
import { getSiteSettings, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashSettingsPage() {
  await requireCapability("settings");

  const settings = await getSiteSettings(FRESH);
  return (
    <DashboardShell active="settings" breadcrumb="لوحة التحكم / النظام" title="الإعدادات">
      <SettingsManager initial={settings} />
    </DashboardShell>
  );
}
