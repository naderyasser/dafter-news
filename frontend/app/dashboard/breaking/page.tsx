import BreakingManager from "@/components/dashboard/BreakingManager";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { getBreakingNews } from "@/lib/api";

export const revalidate = 0;

export default async function DashBreakingPage() {
  const items = await getBreakingNews("?ordering=order&page_size=50");
  return (
    <DashboardShell active="breaking" breadcrumb="لوحة التحكم / المحتوى" title="الأخبار العاجلة">
      <div className="flex max-w-[820px] flex-col gap-5">
        <BreakingManager items={items.results} />
      </div>
    </DashboardShell>
  );
}
