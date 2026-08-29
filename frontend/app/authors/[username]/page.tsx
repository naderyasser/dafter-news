import { notFound } from "next/navigation";

import SectionBlock from "@/components/site/SectionBlock";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getAuthor, mediaUrl } from "@/lib/api";
import { relativeTime, toEasternNumerals } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 300;

/** The byline is the title — a writer's page is the one a reader reaches by
 *  searching their name, and it had no title of its own to match against. */
export async function generateMetadata({ params }: { params: { username: string } }) {
  const author = await getAuthor(params.username);
  if (!author) return { title: "الكاتب" };
  return {
    title: author.name,
    description: author.bio || `مقالات ${author.name} في ${SITE_NAME.ar}.`,
    alternates: { canonical: `${SITE_URL}/authors/${encodeURIComponent(author.username)}` },
  };
}

export default async function AuthorPage({ params }: { params: { username: string } }) {
  const author = await getAuthor(params.username);
  if (!author) notFound();

  // Filtered server-side by author__username (see ArticleViewSet.filterset_fields):
  // this used to fetch the site's 12 most recent Arabic articles overall and
  // filter them client-side by author_username, so any author whose latest
  // piece wasn't among that global top-12 got an empty block here despite
  // author.article_count showing they'd published plenty.
  const articles = await getArticles(
    `?language=ar&author__username=${encodeURIComponent(author.username)}&page_size=12&ordering=-published_at`,
  );
  const cards = articles.results.map((a) => ({
    href: `/article/${a.slug}`,
    title: a.title,
    section: a.section_name,
    time: relativeTime(a.published_at, "ar"),
    badge: a.badge,
    imageSrc: mediaUrl(a.cover_image),
  }));

  return (
    <SiteShell lang="ar" active="authors">
      <div className="mx-auto max-w-[1000px] px-6 py-8">
        <div className="mb-7 flex flex-wrap items-center gap-5 rounded-card border border-line bg-paper p-7">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-[32px] font-extrabold text-brand">
            {author.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl(author.avatar)} alt={author.name} className="h-full w-full object-cover" />
            ) : (
              author.initial
            )}
          </div>
          <div className="min-w-[200px]">
            <h1 className="font-display-ar mb-1.5 text-[24px] font-extrabold text-ink">{author.name}</h1>
            <p className="mb-2.5 max-w-[520px] text-[14px] leading-[1.7] text-ink-3">{author.title || author.bio}</p>
            <div className="flex gap-4 text-[13px] font-semibold text-ink-2">
              <span className="tnum">{toEasternNumerals(author.article_count)} مقال</span>
              <span>•</span>
              <span>انضم في {new Date(author.date_joined).getFullYear()}</span>
            </div>
          </div>
        </div>
      </div>
      {cards.length > 0 && <SectionBlock lang="ar" title="مقالات الكاتب" seeAllHref="#" cards={cards} initialCount={6} />}
    </SiteShell>
  );
}
