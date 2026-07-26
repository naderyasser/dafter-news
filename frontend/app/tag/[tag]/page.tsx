import ArticleCard from "@/components/site/ArticleCard";
import MostReadList from "@/components/site/MostReadList";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getTags, mediaUrl } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 60;

export default async function TagPage({ params }: { params: { tag: string } }) {
  const [tags, articles, mostRead] = await Promise.all([
    getTags(),
    getArticles(`?tags__slug=${params.tag}&ordering=-published_at&page_size=24`),
    getArticles("?ordering=-views&page_size=5"),
  ]);
  const tag = tags.results.find((t) => t.slug === params.tag);

  return (
    <SiteShell lang="ar">
      <div className="mx-auto flex max-w-container flex-wrap items-start gap-10 px-6 py-8">
        <main className="min-w-0 flex-[2_1_560px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-pill bg-brand-tint px-4.5 py-2 text-[16px] font-extrabold text-brand">
            #{tag?.name ?? params.tag}
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
          <MostReadList lang="ar" items={mostRead.results.map((a) => ({ title: a.title, href: `/article/${a.slug}`, section: a.section_name }))} />
        </aside>
      </div>
    </SiteShell>
  );
}
