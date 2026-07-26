import Link from "next/link";

import SiteShell from "@/components/site/SiteShell";
import { getArticles } from "@/lib/api";
import { relativeTime } from "@/lib/format";

export const revalidate = 60;

export default async function OpinionPage() {
  const opinion = await getArticles("?kind=opinion&page_size=24");

  return (
    <SiteShell lang="ar" active="opinion">
      <div className="mx-auto max-w-container px-6 py-8">
        <div className="mb-6 border-s-[3px] border-brand ps-4">
          <h1 className="font-display-ar m-0 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] font-extrabold text-ink">بالعقل والمنطق</h1>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {opinion.results.map((op) => (
            <Link
              key={op.id}
              href={`/opinion/${op.slug}`}
              className="flex flex-col gap-3.5 rounded-card border border-line bg-paper p-5.5 no-underline"
            >
              <span className="font-serif text-[36px] font-extrabold leading-[.6] text-brand">&ldquo;</span>
              <div className="font-display-ar flex-1 text-[16px] font-bold leading-[1.6] text-ink">{op.title}</div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border-2 border-brand bg-brand-tint text-[15px] font-extrabold text-brand">
                  {op.author_initial ?? "؟"}
                </div>
                <span className="text-[13px] font-semibold text-ink-2">{op.author_name}</span>
                <span className="ms-auto text-xs text-ink-3">{relativeTime(op.published_at, "ar")}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
