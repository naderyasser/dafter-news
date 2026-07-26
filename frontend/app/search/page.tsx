import SearchPageContent from "@/components/site/SearchPageContent";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getSections } from "@/lib/api";

export const revalidate = 60;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string; section?: string };
}) {
  const q = (searchParams.q || "").trim();
  const section = searchParams.section || "all";

  // Render the first page of results on the server so a shared /search?q=…
  // link arrives with its answer already on screen.
  const params = new URLSearchParams({ language: "ar", ordering: "-published_at", page_size: "20" });
  if (q) params.set("search", q);
  if (section !== "all") params.set("section__key", section);

  const [initial, sections] = await Promise.all([getArticles(`?${params}`), getSections()]);

  return (
    <SiteShell lang="ar" active="search">
      <div className="mx-auto max-w-[860px] px-6 pb-4 pt-9">
        <SearchPageContent
          initial={initial.results}
          initialTotal={initial.count}
          initialQuery={q}
          initialSection={section}
          sections={sections.results}
        />
      </div>
    </SiteShell>
  );
}
