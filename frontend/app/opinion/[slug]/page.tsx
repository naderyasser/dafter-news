import { notFound } from "next/navigation";

import ArticleBlocks from "@/components/site/ArticleBlocks";
import ArticleComments from "@/components/site/ArticleComments";
import AudioPlayer from "@/components/site/AudioPlayer";
import AuthorProfileCard from "@/components/site/AuthorProfileCard";
import MostReadList from "@/components/site/MostReadList";
import ShareRow from "@/components/site/ShareRow";
import SiteShell from "@/components/site/SiteShell";
import ViewBeacon from "@/components/site/ViewBeacon";
import { getArticle, mediaUrl, getMostRead } from "@/lib/api";
import { publishedLine } from "@/lib/format";
import { articleJsonLd, articleMetadata, SITE_URL } from "@/lib/seo";
import Link from "next/link";

export const revalidate = 30;

/** Existence decided before the stream starts — see app/article/[slug]. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const article = await getArticle(_params.slug);
  if (!article || article.kind !== "opinion" || article.status !== "published") notFound();
  return articleMetadata(article, `/opinion/${encodeURIComponent(article.slug)}`);
}

export default async function ArticleOpinionPage({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const [article, mostRead] = await Promise.all([getArticle(_params.slug), getMostRead("ar")]);
  // See app/article/[slug]/page.tsx for why status is re-checked on the
  // frontend as well as the API.
  if (!article || article.kind !== "opinion" || article.status !== "published") notFound();

  return (
    <SiteShell lang="ar" active="opinion">
      <ViewBeacon slug={article.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd(article, `/opinion/${encodeURIComponent(article.slug)}`) }}
      />
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 max-w-reading flex-[2_1_480px]">
          <div className="mb-4 text-[13px] text-ink-3">
            <Link href="/" className="text-ink-3 no-underline hover:text-brand">
              الرئيسية
            </Link>
            <span className="mx-1.5">/</span>
            <Link href="/opinion" className="text-ink-3 no-underline hover:text-brand">
              بالعقل والمنطق
            </Link>
          </div>

          <h1 className="font-display-ar mb-3.5 text-[clamp(1.375rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.5] text-accent">
            {article.title}
          </h1>
          <div className="mb-5 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[14px] text-ink-3">
            <span className="tnum">{publishedLine(article.published_at, "ar")}</span>
            <ShareRow lang="ar" title={article.title} shareUrl={`${SITE_URL}/opinion/${article.id}`} />
          </div>

          {article.author && <AuthorProfileCard lang="ar" author={article.author} feature />}

          <AudioPlayer lang="ar" audioSrc={mediaUrl(article.tts_audio)} durationSeconds={article.tts_duration_seconds || 255} />

          <ArticleBlocks lang="ar" blocks={article.blocks} />

          {article.tags.length > 0 && (
            <div className="mb-2 mt-7 flex flex-wrap gap-2">
              {article.tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/tag/${t.slug}`}
                  className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          <ArticleComments lang="ar" articleId={article.id} initial={article.comments} />
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="ar"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/article/${a.slug}`,
              section: a.section_name,
              views: a.views,
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
