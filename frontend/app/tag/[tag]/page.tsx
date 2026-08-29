import ArticleCard from "@/components/site/ArticleCard";
import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getTags, mediaUrl, getMostRead } from "@/lib/api";
import { decodeParam, relativeTime } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 60;

/** The tag itself is the title — every tag page shared the site-wide default
 *  before this, so «الذهب» and «السيسي» were one indistinguishable title
 *  repeated across the archive. */
export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const _params = await params;
  const tagSlug = decodeParam(_params.tag);
  const tag = (await getTags()).results.find((t) => t.slug === tagSlug);
  const name = tag?.name || tagSlug;
  return {
    title: name,
    description: `كل أخبار ${name} في ${SITE_NAME.ar} — أحدث التغطيات والتحليلات.`,
    alternates: { canonical: `${SITE_URL}/tag/${encodeURIComponent(tagSlug)}` },
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const _params = await params;
  // Arabic slugs arrive percent-encoded (twice, once via middleware);
  // decode fully before comparing against the API's decoded slug.
  const tagSlug = decodeParam(_params.tag);
  const [tags, articles, mostRead] = await Promise.all([
    getTags(),
    getArticles(`?language=ar&tags__slug=${encodeURIComponent(tagSlug)}&ordering=-published_at&page_size=24`),
    getMostRead("ar"),
  ]);
  const tag = tags.results.find((t) => t.slug === tagSlug);

  return (
    <SiteShell lang="ar">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-brand-tint px-4.5 py-2 text-[16px] font-extrabold text-brand">
            #{tag?.name ?? tagSlug}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
            {articles.results.map((a) => (
              <ArticleCard
                key={a.id}
                lang="ar"
                variant="standard"
                href={`/article/${a.slug}`}
                title={a.title}
                section={a.section_name}
                time={relativeTime(a.published_at, "ar")}
                badge={a.badge}
                imageSrc={mediaUrl(a.cover_image)}
              />
            ))}
          </div>
        </main>
        <aside className="min-w-[260px] max-w-[320px] flex-[1_1_280px]">
          <MostReadList
            lang="ar"
            items={mostRead.results.map((a) => ({
              title: a.title,
              href: `/article/${a.slug}`,
              section: a.section_name,
              views: a.views,
            }))}
          />
        </aside>
      </div>
    </SiteShell>
  );
}
