import Link from "next/link";
import { notFound } from "next/navigation";

import ReelPlayer from "@/components/site/ReelPlayer";
import { ReelPoster, REEL_COPY } from "@/components/site/ReelPoster";
import SiteShell from "@/components/site/SiteShell";
import { getReel, getReels, mediaUrl } from "@/lib/api";
import { REELS_HIDDEN } from "@/lib/hiddenDesks";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const revalidate = 30;

/**
 * A reel's own page — a real, shareable, indexable URL per reel.
 *
 * The lightbox on the home page is where most readers meet a reel; this page
 * is what a shared link, a search result or a middle-click lands on. Reels
 * carry no language field (same as Video), so both editions render the same
 * reel by slug and only the chrome and copy differ.
 */

/** Existence decided before the player mounts — see app/article/[slug] and
 *  app/video/[slug], which do the same for the same reason. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // A hidden desk answers a real 404 — see lib/hiddenDesks.ts.
  if (REELS_HIDDEN) notFound();

  const _params = await params;
  const reel = await getReel(_params.slug);
  if (!reel) notFound();
  const url = `${SITE_URL}/reel/${encodeURIComponent(reel.slug)}`;
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
      siteName: SITE_NAME.ar,
      locale: "ar_EG",
      // 9:16, not the 16:9 the article/video pages use — a poster's real
      // shape, so a WhatsApp/Facebook share preview doesn't crop it wrong.
      images: poster ? [{ url: poster, width: 900, height: 1600, alt: reel.title }] : undefined,
    },
    twitter: { card: poster ? ("summary_large_image" as const) : ("summary" as const), title: reel.title },
  };
}

export default async function ReelPage({ params }: { params: Promise<{ slug: string }> }) {
  if (REELS_HIDDEN) notFound();

  const _params = await params;
  const reel = await getReel(_params.slug);
  if (!reel) notFound();

  const othersRes = await getReels(9);
  const others = othersRes.results
    .filter((r) => r.slug !== reel.slug)
    .slice(0, 8)
    .map((r) => ({ id: r.id, title: r.title, thumbnail: mediaUrl(r.thumbnail), href: `/reel/${r.slug}`, youtubeId: r.youtube_id }));

  const t = REEL_COPY.ar;

  return (
    <SiteShell lang="ar" active="video">
      {/* The media desk's dark band — a reel's own page stays inside that
          identity rather than sitting on the site's usual paper background. */}
      <section className="bg-board py-8">
        <div className="mx-auto max-w-container px-6">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-header-muted no-underline transition-colors hover:text-paper"
          >
            <span aria-hidden className="text-[12px] leading-none rtl:rotate-180 ltr:rotate-0">
              ‹
            </span>
            {t.heading}
          </Link>

          <h1 className="font-display-ar mb-5 max-w-md text-[clamp(1.1rem,1rem+0.6vw,1.375rem)] font-extrabold leading-[1.5] text-paper">
            {reel.title}
          </h1>

          <ReelPlayer
            lang="ar"
            title={reel.title}
            youtubeId={reel.youtube_id}
            shareUrl={`${SITE_URL}/reel/${encodeURIComponent(reel.slug)}`}
            watchUrl={reel.url}
          />

          {/* «رشحنا لك» — right below the player's own action row, in the same
              section: a reader who just finished one reel should find the
              next one before they find a reason to leave. */}
          {others.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display-ar rule-accent rule-on-dark mb-4 ps-3.5 text-[19px] font-black text-paper">
                {t.recommended}
              </h2>
              <ul className="scrollbar-none -mx-6 m-0 flex list-none gap-4 overflow-x-auto px-6 pb-1">
                {others.map((r) => (
                  <li key={r.id} className="shrink-0">
                    <ReelPoster lang="ar" reel={r} t={t} />
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
