import DashboardShell from "@/components/dashboard/DashboardShell";
import FeedsPanel from "@/components/dashboard/FeedsPanel";
import { getSyncLogs } from "@/lib/api";

export const revalidate = 0;

export default async function DashFeedsPage() {
  const logs = await getSyncLogs();
  return (
    <DashboardShell active="feeds" breadcrumb="لوحة التحكم / الإدارة" title="المصادر الخارجية">
      <FeedsPanel logs={logs.results} />
    </DashboardShell>
  );
}
