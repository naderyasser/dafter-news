import DashboardShell from "@/components/dashboard/DashboardShell";
import ReelsManager from "@/components/dashboard/ReelsManager";
import { requireCapability } from "@/lib/dashboardAccess";
import { getReels, FRESH } from "@/lib/api";
import { REELS_HIDDEN } from "@/lib/hiddenDesks";
import { notFound } from "next/navigation";

export const revalidate = 0;

export default async function DashReelsPage() {
  // The client dropped the reels desk from the platform entirely — see
  // lib/hiddenDesks.ts. The screen answers 404 like the public routes do,
  // rather than staying reachable by URL after its nav entry went.
  if (REELS_HIDDEN) notFound();
  // Same capability as the video desk rather than a fourteenth one: this IS
  // «لقطة وتعليق»'s shelf, and whoever runs that desk runs this. A separate
  // capability would mean a migration on the accounts model and a new column
  // in the roles matrix for a screen with three fields on it.
  await requireCapability("videos");

  const reels = await getReels(60, FRESH);
  return (
    <DashboardShell active="reels" breadcrumb="لوحة التحكم / الوسائط" title="حصل إيه؟ — ريلز فيسبوك">
      <ReelsManager reels={reels.results} />
    </DashboardShell>
  );
}
