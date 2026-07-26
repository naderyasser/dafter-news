import SearchPageContent from "@/components/site/SearchPageContent";
import SiteShell from "@/components/site/SiteShell";
import { getArticles } from "@/lib/api";

export const revalidate = 60;

export default async function SearchPage() {
  const initial = await getArticles("?ordering=-published_at&page_size=20");

  return (
    <SiteShell lang="ar">
      <div className="mx-auto max-w-[800px] px-6 pb-2 pt-10">
        <SearchPageContent initial={initial.results} />
      </div>
    </SiteShell>
  );
}
