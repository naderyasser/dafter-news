import AdsManager from "@/components/dashboard/AdsManager";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getAdPlacements } from "@/lib/api";

export const revalidate = 0;

export default async function DashAdsPage() {
  const placements = await getAdPlacements();
  return (
    <DashboardShell active="ads" breadcrumb="لوحة التحكم / الإدارة" title="الإعلانات">
      <AdsManager placements={placements.results} />
    </DashboardShell>
  );
}
