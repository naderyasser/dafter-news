import Link from "next/link";

import SiteShell from "@/components/site/SiteShell";
import { getAuthors, mediaUrl } from "@/lib/api";
import { toEasternNumerals } from "@/lib/format";

export const revalidate = 300;

export default async function AuthorsPage() {
  const authors = await getAuthors();

  return (
    <SiteShell lang="ar" active="authors">
      <div className="mx-auto max-w-container px-6 py-8">
        <div className="mb-6 border-s-[3px] border-brand ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">كتّابنا</h1>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
          {authors.results.map((a) => (
            <Link
              key={a.id}
              href={`/authors/${a.username}`}
              className="flex flex-col items-center gap-1 rounded-card border border-line bg-paper px-4 py-6 text-center no-underline"
            >
              <div className="mb-2.5 flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full bg-brand-tint text-[26px] font-extrabold text-brand">
                {a.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(a.avatar)} alt={a.name} className="h-full w-full object-cover" />
                ) : (
                  a.initial
                )}
              </div>
              <span className="text-[16px] font-bold text-ink">{a.name}</span>
              <span className="mt-1.5 text-[13px] leading-[1.6] text-ink-3">{a.title || a.bio}</span>
              <span className="tnum mt-2.5 text-xs font-bold text-brand">{toEasternNumerals(a.article_count)} مقال</span>
            </Link>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
