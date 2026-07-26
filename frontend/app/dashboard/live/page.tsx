import DashboardShell from "@/components/dashboard/DashboardShell";
import LiveManager from "@/components/dashboard/LiveManager";
import { getLiveStreams } from "@/lib/api";

export const revalidate = 0;

export default async function DashLivePage() {
  const streams = await getLiveStreams();
  return (
    <DashboardShell active="live" breadcrumb="لوحة التحكم / الوسائط والبث" title="البث المباشر">
      <LiveManager stream={streams.results[0] ?? null} />
    </DashboardShell>
  );
}
