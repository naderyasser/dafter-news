import { notFound } from "next/navigation";

import ArticleCard from "@/components/site/ArticleCard";
import SiteShell from "@/components/site/SiteShell";
import VideoComments from "@/components/site/VideoComments";
import { getVideo, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 30;

export default async function VideoPage({ params }: { params: { slug: string } }) {
  const video = await getVideo(params.slug);
  if (!video) notFound();

  const suggestedRes = await getVideos(`?page_size=5`);
  const suggested = suggestedRes.results.filter((v) => v.slug !== video.slug).slice(0, 4);

  return (
    <SiteShell lang="ar" active="video">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="relative aspect-video overflow-hidden rounded-card bg-header-bg">
            {video.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(video.cover_image)} alt={video.title} className="h-full w-full object-cover" />
            ) : null}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(23,26,31,.55)] text-[26px] text-paper">
                <span className="inline-block -scale-x-100">▶</span>
              </span>
            </div>
            {video.is_exclusive && (
              <span className="absolute start-3 top-3 rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">حصري</span>
            )}
            {!video.is_live && video.duration_label !== "—" && (
              <span className="tnum absolute bottom-3 start-3 rounded-badge bg-[rgba(23,26,31,.75)] px-2 py-1 text-xs text-paper">
                {video.duration_label}
              </span>
            )}
          </div>
          <h1 className="font-display-ar mb-2.5 mt-4.5 text-[clamp(1.375rem,1rem+1.4vw,1.75rem)] font-extrabold text-ink">{video.title}</h1>
          <div className="mb-5 flex items-center gap-2.5 text-[13px] text-ink-3">
            <span>{relativeTime(video.created_at, "ar")}</span>
            <span>•</span>
            <span className="tnum">👁 {video.views.toLocaleString("en-US")} مشاهدة</span>
          </div>
          {video.description && <p className="mb-7 text-[16px] leading-[1.8] text-ink-2">{video.description}</p>}

          <VideoComments videoId={video.id} initial={video.comments} />
        </main>
        <aside className="min-w-[260px] max-w-[340px] flex-[1_1_280px]">
          <div className="font-display-ar mb-3.5 border-s-[3px] border-brand ps-3 text-[16px] font-extrabold text-ink">فيديوهات مقترحة</div>
          <div className="flex flex-col">
            {suggested.map((s) => (
              <div key={s.id} className="border-b border-line py-3">
                <ArticleCard
                  lang="ar"
                  variant="compact"
                  href={`/video/${s.slug}`}
                  title={s.title}
                  section={s.section_name}
                  time={relativeTime(s.created_at, "ar")}
                  badge={s.is_exclusive ? "exclusive" : "none"}
                  imageSrc={mediaUrl(s.cover_image)}
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}
