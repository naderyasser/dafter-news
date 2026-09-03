import { Suspense } from "react";

import { notFound } from "next/navigation";

import SiteShell from "@/components/site/SiteShell";
import VideoGrid from "@/components/site/VideoGrid";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getVideos, mediaUrl } from "@/lib/api";
import { VIDEO_DESK_HIDDEN } from "@/lib/hiddenDesks";
import { isArabicScript, relativeTime } from "@/lib/format";

export const revalidate = 60;

async function VideoListContent() {
  const videos = await getVideos("?page_size=24");
  // Same script filter the home page's «لقطة وتعليق» block applies: the
  // video table holds both editions in one column, and without this the
  // English rows surfaced under the Arabic heading here.
  const items = videos.results.filter((v) => isArabicScript(v.title)).map((v) => ({
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
        <div className="mb-5 rule-accent ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">لقطة وتعليق</h1>
        </div>
        <VideoGrid items={items} />
      </div>
    </SiteShell>
  );
}

/** Skeleton inside the page — a loading.tsx here would soft-404 the nested detail routes; see app/page.tsx. */
export const metadata = { title: "لقطة وتعليق", description: "فيديوهات الدفتر — تقارير مصوّرة ولقطات من الحدث." };

export default function VideoListPage() {
  // Hidden desk — see lib/hiddenDesks.ts. Thrown here rather than from a
  // generateMetadata this route does not have; there is no loading.tsx on
  // this path (see the note above `metadata`), so nothing has been flushed
  // yet and the 404 status is real.
  if (VIDEO_DESK_HIDDEN) notFound();

  return (
    <Suspense fallback={<PageSkeleton lang="ar" variant="list" />}>
      <VideoListContent />
    </Suspense>
  );
}
