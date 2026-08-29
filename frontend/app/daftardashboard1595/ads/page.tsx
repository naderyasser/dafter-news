import AdsManager from "@/components/dashboard/AdsManager";
import { requireCapability } from "@/lib/dashboardAccess";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAdPlacements } from "@/lib/api";

export const revalidate = 0;

export default async function DashAdsPage() {
  await requireCapability("ads");

  const placements = await getAdPlacements();
  return (
    <DashboardShell active="ads" breadcrumb="لوحة التحكم / الإدارة" title="الإعلانات">
      <AdsManager placements={placements.results} />
    </DashboardShell>
  );
}
