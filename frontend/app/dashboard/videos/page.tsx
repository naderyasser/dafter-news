import DashboardShell from "@/components/dashboard/DashboardShell";
import VideosManager from "@/components/dashboard/VideosManager";
import { getVideos, FRESH } from "@/lib/api";

export const revalidate = 0;

export default async function DashVideosPage() {
  const videos = await getVideos("?page_size=50", FRESH);
  return (
    <DashboardShell
      active="videos"
      breadcrumb="لوحة التحكم / الوسائط والبث"
      title="الفيديوهات"
      actions={<button className="rounded-lg bg-brand px-4.5 py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong">⬆ رفع فيديو جديد</button>}
    >
      <VideosManager videos={videos.results} />
    </DashboardShell>
  );
}
