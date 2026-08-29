import SearchPageContent from "@/components/site/SearchPageContent";
import SiteShell from "@/components/site/SiteShell";
import { getArticles, getSections } from "@/lib/api";

export const revalidate = 60;

/**
 * English counterpart of /search.
 *
 * NavDrawer and SearchBox both already route an English-mode search here
 * (`/en/search?q=…`); without this page that navigation 404ed, and the
 * "See all results" footer link fell back to the Arabic-only /search page,
 * which forces language=ar and renders RTL chrome regardless of the query.
 */
export const metadata = { title: "Search", description: "Search Al Daftar News for a story, topic or writer." };

export default async function SearchEnPage({
  searchParams,
}: {
  searchParams: { q?: string; section?: string };
}) {
  const q = (searchParams.q || "").trim();
  const section = searchParams.section || "all";

  // Render the first page of results on the server so a shared
  // /en/search?q=… link arrives with its answer already on screen.
  const params = new URLSearchParams({ language: "en", ordering: "-published_at", page_size: "20" });
  if (q) params.set("search", q);
  if (section !== "all") params.set("section__key", section);

  const [initial, sections] = await Promise.all([getArticles(`?${params}`), getSections()]);

  return (
    <SiteShell lang="en" active="search">
      <div className="mx-auto max-w-[860px] px-6 pb-4 pt-9">
        <SearchPageContent
          lang="en"
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
