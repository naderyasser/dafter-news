import { Suspense } from "react";

import OpinionCard from "@/components/site/OpinionCard";
import SiteShell from "@/components/site/SiteShell";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { getArticles, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 60;

async function OpinionContent() {
  const opinion = await getArticles("?language=ar&kind=opinion&page_size=24");

  return (
    <SiteShell lang="ar" active="opinion">
      <div className="mx-auto max-w-container px-6 py-8">
        <div className="mb-6 rule-accent ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">بالعقل والمنطق</h1>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {opinion.results.map((op) => (
            <OpinionCard
              key={op.id}
              lang="ar"
              href={`/opinion/${op.slug}`}
              quote={op.title}
              authorName={op.author_name ?? undefined}
              authorInitial={op.author_initial ?? undefined}
              authorAvatar={mediaUrl(op.author_avatar) ?? undefined}
              time={relativeTime(op.published_at, "ar")}
            />
          ))}
        </div>
      </div>
    </SiteShell>
  );
}

/** Skeleton inside the page — a loading.tsx here would soft-404 the nested detail routes; see app/page.tsx. */
export const metadata = { title: "بالعقل والمنطق", description: "مقالات الرأي في الدفتر — تحليلات وأعمدة كتّابنا." };

export default function OpinionPage() {
  return (
    <Suspense fallback={<PageSkeleton lang="ar" variant="list" />}>
      <OpinionContent />
    </Suspense>
  );
}
