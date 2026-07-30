import Image from "next/image";
import { notFound } from "next/navigation";

import ArticleBlocks from "@/components/site/ArticleBlocks";
import ArticleComments from "@/components/site/ArticleComments";
import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticle, getArticles, mediaUrl } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { articleJsonLd, articleMetadata } from "@/lib/seo";
import Link from "next/link";

export const revalidate = 30;

/** Existence decided before the stream starts — see app/article/[slug]. */
export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await getArticle(params.slug);
  if (!article || article.kind !== "opinion" || article.status !== "published") notFound();
  return articleMetadata(article, `/opinion/${encodeURIComponent(article.slug)}`);
}

export default async function ArticleOpinionPage({ params }: { params: { slug: string } }) {
  const [article, mostRead] = await Promise.all([getArticle(params.slug), getArticles("?language=ar&ordering=-views&page_size=5")]);
  // See app/article/[slug]/page.tsx for why status is re-checked on the
  // frontend as well as the API.
  if (!article || article.kind !== "opinion" || article.status !== "published") notFound();

  return (
    <SiteShell lang="ar" active="opinion">
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

          {article.author && (
            <div className="mb-5 flex items-center gap-3 rounded-card border border-line bg-paper p-3.5">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-brand-tint">
                {article.author.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(article.author.avatar)} alt={article.author.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[22px] font-extrabold text-brand">{article.author.initial}</span>
                )}
              </div>
              <div>
                <div className="text-[15px] font-bold text-ink">{article.author.name}</div>
                <div className="mt-0.5 text-[13px] text-ink-3">{article.author.title || (article.author.bio ?? "")}</div>
              </div>
            </div>
          )}

          <h1 className="font-display-ar mb-3.5 text-[clamp(1.375rem,1rem+1.6vw,1.75rem)] font-extrabold leading-[1.5] text-accent">
            {article.title}
          </h1>
          <div className="mb-6 flex items-center gap-2 border-y border-line py-3 text-[14px] text-ink-3">
            <span>{formatDate(article.published_at, "ar")}</span>
            <span>•</span>
            <span>◔ {article.read_minutes} دقائق قراءة</span>
          </div>

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
              imageSrc: mediaUrl(a.cover_image),
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
