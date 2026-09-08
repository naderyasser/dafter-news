import DashboardShell from "@/components/dashboard/DashboardShell";
import ReelsManager from "@/components/dashboard/ReelsManager";
import { requireCapability } from "@/lib/dashboardAccess";
import { getReels, FRESH } from "@/lib/api";
import { REELS_HIDDEN } from "@/lib/hiddenDesks";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function DashReelsPage() {
  // A hidden desk's screen answers 404 like its public routes do — see
  // lib/hiddenDesks.ts.
  if (REELS_HIDDEN) notFound();
  // Same capability as the video desk rather than a fourteenth one: this IS
  // «لقطة وتعليق»'s shelf, and whoever runs that desk runs this.
  await requireCapability("videos");

  const reels = await getReels(60, FRESH);
  return (
    <DashboardShell active="reels" breadcrumb="لوحة التحكم / الوسائط" title="حصل إيه؟ — ريلز يوتيوب">
      <ReelsManager reels={reels.results} />
    </DashboardShell>
  );
}
