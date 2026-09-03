import MostReadPageContent from "@/components/site/MostReadPageContent";
import SiteShell from "@/components/site/SiteShell";
import { mediaUrl, getMostRead } from "@/lib/api";
import { articleHref } from "@/lib/routes";

export const revalidate = 60;

export const metadata = { title: "الأكثر قراءة", description: "أكثر أخبار الدفتر قراءةً — ما يتابعه القرّاء الآن." };

export default async function MostReadPage() {
  const articles = await getMostRead("ar", 10);

  return (
    <SiteShell lang="ar" active="most-read">
      <div className="mx-auto max-w-[1000px] px-6 py-8">
        <MostReadPageContent
          rows={articles.results.map((a) => ({
            title: a.title,
            section: a.section_name,
            href: articleHref(a),
            views: a.views,
            imageSrc: mediaUrl(a.cover_image),
          }))}
        />
      </div>
    </SiteShell>
  );
}
