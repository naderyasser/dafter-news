import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleBlocks from "@/components/site/ArticleBlocks";
import ArticleComments from "@/components/site/ArticleComments";
import AuthorProfileCard from "@/components/site/AuthorProfileCard";
import InfiniteSections from "@/components/site/InfiniteSections";
import AudioPlayer from "@/components/site/AudioPlayer";
import LatestNewsCard from "@/components/site/LatestNewsCard";
import ShareRow from "@/components/site/ShareRow";
import SiteShell from "@/components/site/SiteShell";
import ViewBeacon from "@/components/site/ViewBeacon";
import { getArticle, getLatest, getMostRead, getRelatedArticles, getSections, mediaUrl } from "@/lib/api";
import { publishedLine, relativeTime } from "@/lib/format";
import { articleHref } from "@/lib/routes";
import { articleJsonLd, articleMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 30;

/**
 * Existence is decided HERE, not only in the page body. generateMetadata
 * runs before the response starts streaming, so notFound() thrown from it
 * produces a real HTTP 404 — thrown from the body of a route that has a
 * loading.tsx boundary, it lands after the 200 status has already been
 * flushed, and crawlers were told to index a page whose content said
 * «غير موجود». (The page body keeps its own check as defence in depth;
 * Next dedupes the fetch, so the article is still requested once.)
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const article = await getArticle(_params.slug);
  if (!article || article.kind !== "news" || article.status !== "published") notFound();
  return articleMetadata(article, `/article/${encodeURIComponent(article.slug)}`);
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const article = await getArticle(_params.slug);
  // status is re-checked here even though the API already scopes anonymous
  // reads to published articles: this keeps a draft/scheduled/rejected story
  // from rendering in full if the API ever forwards a staff session (see
  // lib/api.ts's serverCookieHeader) into a fetch cached for every anonymous
  // visitor for the rest of this page's revalidate window.
  if (!article || article.kind !== "news" || article.status !== "published") notFound();

  // «أحدث الأخبار» / «الأكثر قراءة» tabbed card block, right after the
  // article — fetched one over LIST_LIMIT so filtering the article being
  // read out of its own "read next" list never leaves a short row.
  const LIST_LIMIT = 5;

  // Related by shared tags (people/topics) first, section recency as the
  // fallback — computed by /related/ so every surface ranks the same way.
  const [related, sections, latest, mostRead] = await Promise.all([
    getRelatedArticles(article.slug),
    getSections(),
    getLatest("ar", LIST_LIMIT + 1),
    getMostRead("ar", LIST_LIMIT + 1),
  ]);
  // Sections appended below the article; skip the one we're already in.
  const feedSections = sections.results.filter((s) => s.key !== article.section?.key && s.key !== "opinion");
  // All of them land inside the body itself (client ask: «تعرض داخل محتوى
  // الخبر نفسه»), in the one box — a second «أخبار ذات صلة» list stacked
  // below the comments used to repeat the same heading a scroll further
  // down, which read as the section showing up twice on one article.
  const relatedInline = related.results
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3)
    .map((a) => ({
      href: articleHref(a),
      title: a.title,
      section: a.section_name,
      badge: a.badge,
      imageSrc: mediaUrl(a.cover_image),
      kind: a.kind,
      authorAvatar: mediaUrl(a.author_avatar),
    }));

  const toNewsCardItem = (a: (typeof latest.results)[number]) => ({
    href: articleHref(a),
    title: a.title,
    imageSrc: mediaUrl(a.cover_image),
  });
  // Never show the article itself in its own "read next" widget — same
  // reasoning as relatedInline's own filter above.
  const latestCards = latest.results.filter((a) => a.slug !== article.slug).slice(0, LIST_LIMIT).map(toNewsCardItem);
  const mostReadCards = mostRead.results.filter((a) => a.slug !== article.slug).slice(0, LIST_LIMIT).map(toNewsCardItem);

  const badgeLabel = { breaking: "عاجل", live: "مباشر", exclusive: "خاص", none: "" }[article.badge];

  return (
    <SiteShell lang="ar" active={article.section?.key}>
      <ViewBeacon slug={article.slug} />
      {/* NewsArticle structured data — what Google News actually reads.
          Content is JSON.stringify output of our own fields; nothing here
          is raw editor markup. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd(article, `/article/${encodeURIComponent(article.slug)}`) }}
      />
      {/* Centred reading column: equal inline margins both sides, and no
          sidebar — it ran out of content and left a dead rail. */}
      <div className="mx-auto w-full max-w-reading px-6 py-8">
        <main className="min-w-0">
          <div className="mb-4 text-[13px] text-ink-3">
            <Link href="/" className="text-ink-3 no-underline hover:text-accent">
              الرئيسية
            </Link>
            <span className="mx-1.5">/</span>
            {article.section && (
              <Link href={`/section/${article.section.key}`} className="text-ink-3 no-underline hover:text-accent">
                {article.section.name_ar}
              </Link>
            )}
          </div>

          {badgeLabel && <span className="rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">{badgeLabel}</span>}

          {/* The headline is the one place the secondary blue is unconditional:
              «كسر حدة اللون الأحمر» starts with the largest type on the page.
              Section colours stay on section chrome — a «ملف خاص» headline in
              brand red would put the loudest colour on the loudest element. */}
          <h1 className="font-display-ar my-3.5 text-[clamp(1.375rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.5] text-accent">
            {article.title}
          </h1>
          {article.standfirst && (
            <p className="mb-4 text-[clamp(1.0625rem,1rem+0.3vw,1.1875rem)] font-medium leading-[1.7] text-ink-2">{article.standfirst}</p>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[14px] text-ink-3">
            {/* A manual byline is a deliberate override — same priority as
                ArticleCardSerializer.get_author_name — so it wins even when
                an account also happens to be linked, and has no profile to
                link out to since it isn't one. */}
            {article.byline ? (
              <span className="font-bold text-ink-2">{article.byline}</span>
            ) : article.author ? (
              <Link href={`/authors/${article.author.username}`} className="font-bold text-ink-2 no-underline">
                {article.author.name}
              </Link>
            ) : null}
            <span>•</span>
            <span className="tnum">{publishedLine(article.published_at, "ar")}</span>
            <ShareRow lang="ar" title={article.title} shareUrl={`${SITE_URL}/article/${article.id}`} />
          </div>

          {/* «ملف خاص» pieces are signed investigations — the reporter's
              profile sits under the headline like an opinion column's. */}
          {article.section?.key === "special" && article.author && (
            <div className="mt-4">
              <AuthorProfileCard lang="ar" author={article.author} />
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

          <AudioPlayer lang="ar" audioSrc={mediaUrl(article.tts_audio)} durationSeconds={article.tts_duration_seconds || 255} />

          <ArticleBlocks lang="ar" blocks={article.blocks} relatedCards={relatedInline} />

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

          {/* Client ask: the first block after an article's own content —
              content/tags/comments — before the cross-section feed further
              down (InfiniteSections). A tabbed red-headed card list rather
              than the plain heading-and-list MostReadList used to render
              solo here: «أحدث الأخبار» opens active per the client's
              reference, «الأكثر قراءة» is the second tab rather than a
              second block stacked under it — the client's own "saves
              vertical space" reasoning for combining the two. */}
          <div className="mt-8">
            <LatestNewsCard lang="ar" latest={latestCards} mostRead={mostReadCards} />
          </div>
        </main>
      </div>

      <InfiniteSections lang="ar" sections={feedSections} excludeSlug={article.slug} />
    </SiteShell>
  );
}
