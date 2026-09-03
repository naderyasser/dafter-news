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
import { publishedLine } from "@/lib/format";
import { articleJsonLd, articleMetadata, SITE_URL } from "@/lib/seo";

export const revalidate = 30;

/** Existence decided before the stream starts — see app/article/[slug]. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const article = await getArticle(_params.slug);
  if (!article || article.language !== "en" || article.status !== "published") notFound();
  return articleMetadata(article, `/en/article/${encodeURIComponent(article.slug)}`);
}

export default async function ArticleEnPage({ params }: { params: Promise<{ slug: string }> }) {
  const _params = await params;
  const article = await getArticle(_params.slug);
  // See app/article/[slug]/page.tsx for why status is re-checked on the
  // frontend as well as the API.
  if (!article || article.language !== "en" || article.status !== "published") notFound();

  // «Latest News» / «Most Read» tabbed card block, right after the article
  // — fetched one over LIST_LIMIT so filtering the article being read out
  // of its own "read next" list never leaves a short row. Mirrors the
  // Arabic article page exactly; see its own comments for the reasoning
  // behind every choice here.
  const LIST_LIMIT = 5;

  // Same automatic related ranking as the Arabic page: shared tags first,
  // then section recency — /related/ filters by the article's own language.
  const [related, sections, latest, mostRead] = await Promise.all([
    getRelatedArticles(article.slug),
    getSections(),
    getLatest("en", LIST_LIMIT + 1),
    getMostRead("en", LIST_LIMIT + 1),
  ]);
  // Sections appended below the article; skip the one we're already in.
  const feedSections = sections.results.filter((s) => s.key !== article.section?.key && s.key !== "opinion");
  // All of them land inside the body itself, in the one box — see the
  // Arabic article page for why a second list below wasn't kept.
  const relatedInline = related.results
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3)
    .map((a) => ({
      href: `/en/article/${a.slug}`,
      title: a.title,
      section: a.section_name,
      badge: a.badge,
      imageSrc: mediaUrl(a.cover_image),
      kind: a.kind,
      authorAvatar: mediaUrl(a.author_avatar),
    }));

  const toNewsCardItem = (a: (typeof latest.results)[number]) => ({
    href: `/en/article/${a.slug}`,
    title: a.title,
    imageSrc: mediaUrl(a.cover_image),
  });
  // Never show the article itself in its own "read next" widget — same
  // reasoning as relatedInline's own filter above.
  const latestCards = latest.results.filter((a) => a.slug !== article.slug).slice(0, LIST_LIMIT).map(toNewsCardItem);
  const mostReadCards = mostRead.results.filter((a) => a.slug !== article.slug).slice(0, LIST_LIMIT).map(toNewsCardItem);

  const badgeLabel = { breaking: "Breaking", live: "Live", exclusive: "Exclusive", none: "" }[article.badge];

  return (
    <SiteShell lang="en" active={article.section?.key}>
      <ViewBeacon slug={article.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd(article, `/en/article/${encodeURIComponent(article.slug)}`) }}
      />
      {/* Centred reading column: equal inline margins both sides, and no
          sidebar — mirrors the Arabic article page exactly (see its own
          comment: a sidebar here ran out of content and left a dead rail). */}
      <div className="mx-auto w-full max-w-reading px-6 py-8">
        <main className="min-w-0">
          <div className="mb-4 text-[13px] text-ink-3">
            <Link href="/en" className="text-ink-3 no-underline hover:text-accent">
              Home
            </Link>
            <span className="mx-1.5">/</span>
            {article.section && (
              <Link href={`/en/section/${article.section.key}`} className="text-ink-3 no-underline hover:text-accent">
                {article.section.name_en || article.section.name_ar}
              </Link>
            )}
          </div>

          {badgeLabel && <span className="rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">{badgeLabel}</span>}

          <h1 className="font-display-en my-3.5 text-[clamp(1.375rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.3] text-accent">{article.title}</h1>
          {article.standfirst && <p className="mb-4 text-[clamp(1.0625rem,1rem+0.3vw,1.1875rem)] font-medium leading-[1.6] text-ink-2">{article.standfirst}</p>}

          <div className="mb-2 flex flex-wrap items-center gap-2 border-y border-line py-3 text-[14px] text-ink-3">
            {/* A manual byline is a deliberate override — same priority as
                ArticleCardSerializer.get_author_name — so it wins even when
                an account also happens to be linked. */}
            {/* Not a link, deliberately: /authors/[username] has no
                English-language counterpart route, so linking here would
                send an English reader to Arabic-only chrome mid-read. */}
            {article.byline ? (
              <span className="font-bold text-ink-2">{article.byline}</span>
            ) : article.author ? (
              <span className="font-bold text-ink-2">{article.author.name}</span>
            ) : null}
            <span>•</span>
            <span className="tnum">{publishedLine(article.published_at, "en")}</span>
            <ShareRow lang="en" title={article.title} shareUrl={`${SITE_URL}/en/article/${article.id}`} />
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

          <ArticleBlocks lang="en" blocks={article.blocks} relatedCards={relatedInline} />

          {article.tags.length > 0 && (
            <div className="mb-2 mt-7 flex flex-wrap gap-2">
              {article.tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/en/tag/${t.slug}`}
                  className="rounded-pill bg-brand-tint px-3.5 py-1.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          <ArticleComments lang="en" articleId={article.id} initial={article.comments} />

          {/* Mirrors the Arabic article page exactly — the first block
              after the article's own content/tags/comments, before the
              cross-section feed further down (InfiniteSections). */}
          <div className="mt-8">
            <LatestNewsCard lang="en" latest={latestCards} mostRead={mostReadCards} />
          </div>
        </main>
      </div>

      <InfiniteSections lang="en" sections={feedSections} excludeSlug={article.slug} />
    </SiteShell>
  );
}
