import SiteShell from "@/components/site/SiteShell";
import VideoGrid from "@/components/site/VideoGrid";
import { getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 60;

export default async function VideoListPage() {
  const videos = await getVideos("?page_size=24");
  const items = videos.results.map((v) => ({
    id: v.id,
    href: `/video/${v.slug}`,
    title: v.title,
    section: v.section_name || "",
    time: relativeTime(v.created_at, "ar"),
    badge: (v.is_exclusive ? "exclusive" : "none") as "none" | "exclusive",
    imageSrc: mediaUrl(v.cover_image),
    duration: v.duration_label,
    comments: v.comment_count,
  }));

  return (
    <SiteShell lang="ar" active="video">
      <div className="mx-auto max-w-container px-6 py-8">
        <div className="mb-5 border-s-[3px] border-brand ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">لقطة وتعليق</h1>
        </div>
        <VideoGrid items={items} />
      </div>
    </SiteShell>
  );
}
