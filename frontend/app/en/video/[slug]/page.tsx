import { notFound } from "next/navigation";

import ArticleCard from "@/components/site/ArticleCard";
import SiteShell from "@/components/site/SiteShell";
import VideoComments from "@/components/site/VideoComments";
import VideoPlayer from "@/components/site/VideoPlayer";
import { getVideo, getVideos, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 30;

// Video carries no language field (see app/en/page.tsx's videoCards) — the
// English home page buckets videos by script the same way it does tags and
// stories, so the suggestions rail here does too, instead of mixing Arabic
// titles into an English reader's "Suggested videos" list.
const isLatin = (s: string) => !/[؀-ۿ]/.test(s);

/**
 * English counterpart of /video/[slug].
 *
 * The English home page links its own (Latin-titled) video cards to
 * `/video/<slug>` with no `/en` prefix — before this route existed, that
 * landed on the Arabic-only video page, which hardcoded Arabic chrome and
 * copy regardless of the video's own language.
 */
export default async function VideoEnPage({ params }: { params: { slug: string } }) {
  const video = await getVideo(params.slug);
  if (!video) notFound();

  const suggestedRes = await getVideos(`?page_size=8`);
  const suggested = suggestedRes.results
    .filter((v) => v.slug !== video.slug && isLatin(v.title))
    .slice(0, 4);

  return (
    <SiteShell lang="en" active="video">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-8 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <VideoPlayer
            lang="en"
            src={mediaUrl(video.file)}
            externalUrl={video.external_url}
            poster={mediaUrl(video.cover_image)}
            title={video.title}
            isExclusive={video.is_exclusive}
            durationLabel={video.is_live ? undefined : video.duration_label}
          />
          <h1 className="font-display-en mb-2.5 mt-4.5 text-[clamp(1.375rem,1rem+1.4vw,1.75rem)] font-extrabold text-ink">{video.title}</h1>
          <div className="mb-5 flex items-center gap-2.5 text-[13px] text-ink-3">
            <span>{relativeTime(video.created_at, "en")}</span>
            <span>•</span>
            <span className="tnum">👁 {video.views.toLocaleString("en-US")} views</span>
          </div>
          {video.description && <p className="mb-7 text-[16px] leading-[1.8] text-ink-2">{video.description}</p>}

          <VideoComments lang="en" videoId={video.id} initial={video.comments} />
        </main>
        <aside className="min-w-[260px] max-w-[340px] flex-[1_1_280px]">
          <div className="font-display-en mb-3.5 rule-accent ps-3.5 text-[16px] font-extrabold text-ink">Suggested videos</div>
          <div className="flex flex-col">
            {suggested.map((s) => (
              <div key={s.id} className="border-b border-line py-3">
                <ArticleCard
                  lang="en"
                  variant="compact"
                  href={`/en/video/${s.slug}`}
                  title={s.title}
                  section={s.section_name}
                  time={relativeTime(s.created_at, "en")}
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
