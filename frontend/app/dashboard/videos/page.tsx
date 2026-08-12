import DashboardShell from "@/components/dashboard/DashboardShell";
import VideosManager from "@/components/dashboard/VideosManager";
import { getSections, getVideos, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashVideosPage() {
  const [videos, sections] = await Promise.all([getVideos("?page_size=50", FRESH), getSections(FRESH)]);
  return (
    // The upload button moved into VideosManager — it opens a dialog, which
    // the server-rendered shell can't do.
    <DashboardShell active="videos" breadcrumb="لوحة التحكم / الوسائط" title="الفيديوهات">
      <VideosManager videos={videos.results} sections={sections.results} />
    </DashboardShell>
  );
}
