import BreakingManager from "@/components/dashboard/BreakingManager";
import { requireCapability } from "@/lib/dashboardAccess";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getBreakingNews, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashBreakingPage() {
  await requireCapability("breaking");

  const items = await getBreakingNews("?ordering=order&page_size=50", FRESH);
  return (
    <DashboardShell active="breaking" breadcrumb="لوحة التحكم / المحتوى" title="الأخبار العاجلة">
      <div className="flex max-w-[820px] flex-col gap-5">
        <BreakingManager items={items.results} />
      </div>
    </DashboardShell>
  );
}
