import DashboardShell from "@/components/dashboard/DashboardShell";
import TickerManager from "@/components/dashboard/TickerManager";
import { getTickerModules } from "@/lib/api";

export const revalidate = 0;

export default async function DashTickerPage() {
  const modules = await getTickerModules();
  return (
    <DashboardShell active="ticker" breadcrumb="لوحة التحكم / الإدارة" title="شريط الأسواق">
      <div className="flex max-w-[760px] flex-col gap-5">
        <TickerManager items={modules.results} />
      </div>
    </DashboardShell>
  );
}
