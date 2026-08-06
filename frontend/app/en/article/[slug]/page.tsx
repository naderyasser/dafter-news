import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleBlocks from "@/components/site/ArticleBlocks";
import ArticleComments from "@/components/site/ArticleComments";
import AudioPlayer from "@/components/site/AudioPlayer";
import AuthorProfileCard from "@/components/site/AuthorProfileCard";
import MostReadList from "@/components/site/MostReadList";
import SectionBlock from "@/components/site/SectionBlock";
import ShareRow from "@/components/site/ShareRow";
import SiteShell from "@/components/site/SiteShell";
import { getArticle, getArticles, getRelatedArticles, mediaUrl } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/format";
import { articleJsonLd, articleMetadata } from "@/lib/seo";

export const revalidate = 30;

/** Existence decided before the stream starts — see app/article/[slug]. */
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article || article.language !== "en" || article.status !== "published") notFound();
  return articleMetadata(article, `/en/article/${encodeURIComponent(article.slug)}`);
}

export default async function ArticleEnPage({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  // See app/article/[slug]/page.tsx for why status is re-checked on the
  // frontend as well as the API.
  if (!article || article.language !== "en" || article.status !== "published") notFound();

  // Same automatic related ranking as the Arabic page: shared tags first,
  // then section recency — /related/ filters by the article's own language.
  const [related, mostRead] = await Promise.all([
    getRelatedArticles(article.slug),
    getArticles("?language=en&ordering=-views&page_size=5"),
  ]);
  const relatedCards = related.results
    .filter((a) => a.slug !== article.slug)
    .slice(0, 4)
    .map((a) => ({ href: `/en/article/${a.slug}`, title: a.title, section: a.section_name, time: relativeTime(a.published_at, "en"), badge: a.badge, imageSrc: mediaUrl(a.cover_image) }));

  const badgeLabel = { breaking: "Breaking", live: "Live", exclusive: "Exclusive", none: "" }[article.badge];

  return (
    <SiteShell lang="en" active={article.section?.key}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd(article, `/en/article/${encodeURIComponent(article.slug)}`) }}
      />
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 max-w-reading flex-[2_1_480px]">
          <div className="mb-4 text-[13px] text-ink-3">
            <Link href="/en" className="text-ink-3 no-underline hover:text-accent">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            {article.section && <span className="text-ink-3">{article.section.name_en || article.section.name_ar}</span>}
          </div>

          {badgeLabel && <span className="rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">{badgeLabel}</span>}

          <h1 className="font-display-en my-3.5 text-[clamp(1.375rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.3] text-accent">{article.title}</h1>
          {article.standfirst && <p className="mb-4 text-[clamp(1.0625rem,1rem+0.3vw,1.1875rem)] font-medium leading-[1.6] text-ink-2">{article.standfirst}</p>}

          <div className="mb-2 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[14px] text-ink-3">
            {/* A manual byline is a deliberate override — same priority as
                ArticleCardSerializer.get_author_name — so it wins even when
                an account also happens to be linked. */}
            {article.byline ? (
              <span className="font-bold text-ink-2">{article.byline}</span>
            ) : article.author ? (
              <span className="font-bold text-ink-2">{article.author.name}</span>
            ) : null}
            <span>•</span>
            <span>{formatDate(article.published_at, "en")}</span>
            <span>•</span>
            <span>◔ {article.read_minutes} min read</span>
            <ShareRow lang="en" title={article.title} />
          </div>

          {/* Signed investigations carry the reporter's profile — see the
              Arabic article page. */}
          {article.section?.key === "special" && article.author && (
            <div className="mt-4">
              <AuthorProfileCard lang="en" author={article.author} />
            </div>
          )}

          {article.cover_image && (
            <figure className="mb-1 mt-4">
              <div className="relative aspect-video overflow-hidden rounded-card bg-surface-2">
                <Image
                  src={mediaUrl(article.cover_image)!}
                  alt={article.cover_caption || article.title}
                  fill
                  priority
                  sizes="(min-width: 768px) 680px, 100vw"
                  className="object-cover"
                />
              </div>
              {article.cover_caption && (
                <figcaption className="mt-2 border-b border-line pb-3 text-caption text-ink-3">
                  {article.cover_caption}
                  {article.cover_credit ? ` — ${article.cover_credit}` : ""}
                </figcaption>
              )}
            </figure>
          )}

          <AudioPlayer lang="en" audioSrc={mediaUrl(article.tts_audio)} durationSeconds={article.tts_duration_seconds || 255} />

          <ArticleBlocks lang="en" blocks={article.blocks} />

          {article.tags.length > 0 && (
            <div className="mb-2 mt-7 flex flex-wrap gap-2">
              {article.tags.map((t) => (
                <span key={t.id} className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand">
                  {t.name}
                </span>
              ))}
            </div>
          )}

          <ArticleComments lang="en" articleId={article.id} initial={article.comments} />
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="en"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/en/article/${a.slug}`,
              section: a.section_name,
              // The Arabic home passes thumbs; leaving them off here made the
              // same widget look broken on the English edition.
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
        </aside>
      </div>

      {relatedCards.length > 0 && <SectionBlock lang="en" title="Related News" seeAllHref="#" cards={relatedCards} />}
    </SiteShell>
  );
}
