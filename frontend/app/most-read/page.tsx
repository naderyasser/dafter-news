import MostReadPageContent from "@/components/site/MostReadPageContent";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, mediaUrl } from "@/lib/api";

export const revalidate = 60;

export default async function MostReadPage() {
  const articles = await getArticles("?language=ar&ordering=-views&page_size=10");

  return (
    <SiteShell lang="ar" active="most-read">
      <div className="mx-auto max-w-[1000px] px-6 py-8">
        <MostReadPageContent
          rows={articles.results.map((a) => ({
            title: a.title,
            section: a.section_name,
            href: `/article/${a.slug}`,
            imageSrc: mediaUrl(a.cover_image),
          }))}
        />
      </div>
    </SiteShell>
  );
}
