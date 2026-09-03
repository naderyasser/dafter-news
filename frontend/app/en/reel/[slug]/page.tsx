import Link from "next/link";
import { notFound } from "next/navigation";

import ReelPlayer from "@/components/site/ReelPlayer";
import { ReelPoster, REEL_COPY } from "@/components/site/ReelsRail";
import SiteShell from "@/components/site/SiteShell";
import { getReel, getReels, mediaUrl } from "@/lib/api";
import { REELS_HIDDEN } from "@/lib/hiddenDesks";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 30;

/**
 * English counterpart of /reel/[slug].
 *
 * Mirrors it exactly — see the Arabic page's own comments for the reasoning
 * behind every choice here. Reels carry no language field (same as Video;
 * see app/en/page.tsx's own reelCards), so both editions render the exact
 * same reel by slug; only the chrome and copy differ.
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // Hidden desk — see lib/hiddenDesks.ts. A real 404 rather than an empty
  // page: the shelf is off the public site, so its URLs must not resolve.
  if (REELS_HIDDEN) notFound();

  const _params = await params;
  const reel = await getReel(_params.slug);
  if (!reel) notFound();
  const url = `${SITE_URL}/en/reel/${encodeURIComponent(reel.slug)}`;
  const poster = mediaUrl(reel.thumbnail);
  return {
    title: reel.title,
    description: reel.title,
    alternates: { canonical: url },
    openGraph: {
      type: "video.other" as const,
      title: reel.title,
      description: reel.title,
      url,
      siteName: SITE_NAME.en,
      locale: "en_US",
      images: poster ? [{ url: poster, width: 900, height: 1600, alt: reel.title }] : undefined,
    },
    twitter: { card: poster ? ("summary_large_image" as const) : ("summary" as const), title: reel.title },
  };
}

export default async function ReelEnPage({ params }: { params: Promise<{ slug: string }> }) {
  // Hidden desk — see lib/hiddenDesks.ts. A real 404 rather than an empty
  // page: the shelf is off the public site, so its URLs must not resolve.
  if (REELS_HIDDEN) notFound();

  const _params = await params;
  const reel = await getReel(_params.slug);
  if (!reel) notFound();

  const othersRes = await getReels(9);
  const others = othersRes.results
    .filter((r) => r.slug !== reel.slug)
    .slice(0, 8)
    .map((r) => ({ id: r.id, title: r.title, thumbnail: mediaUrl(r.thumbnail), href: `/en/reel/${r.slug}` }));

  return (
    <SiteShell lang="en" active="video">
      <section className="bg-board py-8">
        <div className="mx-auto max-w-container px-6">
          <Link
            href="/en"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-header-muted no-underline transition-colors hover:text-paper"
          >
            <span aria-hidden className="text-[12px] leading-none rtl:rotate-180 ltr:rotate-0">
              ‹
            </span>
            {REEL_COPY.en.heading}
          </Link>

          <h1 className="font-display-en mb-5 max-w-md text-[clamp(1.1rem,1rem+0.6vw,1.375rem)] font-extrabold leading-[1.5] text-paper">
            {reel.title}
          </h1>

          <ReelPlayer lang="en" title={reel.title} facebookUrl={reel.facebook_url} />

          {/* «Recommended for you» — mirrors the Arabic page exactly; see its
              own comments for why this sits right below the action row
              rather than as a separate section further down the page. */}
          {others.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display-en rule-accent rule-on-dark mb-4 ps-3.5 text-[19px] font-black text-paper">
                {REEL_COPY.en.recommended}
              </h2>
              <ul className="scrollbar-none -mx-6 m-0 flex list-none gap-4 overflow-x-auto px-6 pb-1">
                {others.map((r) => (
                  <li key={r.id} className="shrink-0">
                    <ReelPoster lang="en" reel={r} t={REEL_COPY.en} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
