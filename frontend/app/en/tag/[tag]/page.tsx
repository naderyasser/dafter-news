import ArticleCard from "@/components/site/ArticleCard";
import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getTags, mediaUrl, getMostRead } from "@/lib/api";
import { decodeParam, relativeTime } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 60;

/**
 * English counterpart of /tag/[tag].
 *
 * The English home page's trending-tag pills (already filtered to
 * Latin-script tag names) link straight to `/tag/<slug>` with no `/en`
 * prefix, which — before this route existed — landed on the Arabic-only tag
 * page: it queries `language=ar` unconditionally, so an English tag's own
 * (English) articles never matched, and the page rendered Arabic RTL chrome
 * regardless. This mirrors that page with language=en and English chrome.
 */
/** Same reason as the Arabic tag page: the tag is the title. */
export async function generateMetadata({ params }: { params: { tag: string } }) {
  const tagSlug = decodeParam(params.tag);
  const tag = (await getTags()).results.find((t) => t.slug === tagSlug);
  const name = tag?.name || tagSlug;
  return {
    title: name,
    description: `All ${name} news from ${SITE_NAME.en}.`,
    alternates: { canonical: `${SITE_URL}/en/tag/${encodeURIComponent(tagSlug)}` },
  };
}

export default async function TagEnPage({ params }: { params: { tag: string } }) {
  // Arabic slugs arrive percent-encoded (twice, once via middleware); Latin
  // ones don't need it, but decoding is a no-op for them either way.
  const tagSlug = decodeParam(params.tag);
  const [tags, articles, mostRead] = await Promise.all([
    getTags(),
    getArticles(`?language=en&tags__slug=${encodeURIComponent(tagSlug)}&ordering=-published_at&page_size=24`),
    getMostRead("en"),
  ]);
  const tag = tags.results.find((t) => t.slug === tagSlug);

  return (
    <SiteShell lang="en">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-brand-tint px-4.5 py-2 text-[16px] font-extrabold text-brand">
            #{tag?.name ?? tagSlug}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {articles.results.map((a) => (
              <ArticleCard
                key={a.id}
                lang="en"
                variant="standard"
                href={`/en/article/${a.slug}`}
                title={a.title}
                section={a.section_name}
                time={relativeTime(a.published_at, "en")}
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
              />
            ))}
          </div>
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="en"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/en/article/${a.slug}`,
              section: a.section_name,
              views: a.views,
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
