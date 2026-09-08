import Link from "next/link";

import ReelsLightbox from "@/components/site/ReelsLightbox";
import { REEL_COPY, type ReelCard } from "@/components/site/ReelPoster";

/**
 * «حصل إيه؟» — the YouTube shorts shelf on the home page.
 *
 * Pressing a card opens that reel in a lightbox player over the page, with
 * the rest of the shelf a press or a swipe away (ReelsLightbox); the card is
 * still a real link to the reel's own page (/reel/<slug>) for crawlers,
 * middle-clicks and readers with scripts off.
 *
 * Light-themed, unlike the rest of the media desk: the client asked for it
 * by name to match a competitor's own light reels shelf. It sits right after
 * «سياسة», ahead of every other curated desk — the client's placement call.
 *
 * This component is a plain server component: a heading, a link and the
 * client-side rail. The rail is a native horizontal scroller, so it needs
 * no arrows of its own — a trackpad, a touch drag and the Tab key all move
 * it without any script.
 */
export default function ReelsRail({
  lang,
  reels,
  channelUrl,
}: {
  lang: "ar" | "en";
  reels: ReelCard[];
  /** The paper's own YouTube channel — the header's «المزيد» link opens it. */
  channelUrl?: string;
}) {
  if (reels.length === 0) return null;
  const isAr = lang === "ar";
  const t = isAr ? REEL_COPY.ar : REEL_COPY.en;

  return (
    <section className="bg-paper py-8" aria-labelledby="reels-heading">
      <div className="mx-auto max-w-container px-6">
        {/* The editorial-rail header: a bold nameplate with a play mark, a
            lighter «المزيد» link under it, and a two-tone accent bar beneath
            both — brand red on the third nearer the title, a neutral tint
            filling the rest. Built as a plain flex row so it mirrors with the
            page's own `dir`. `font-black` (900) is the one deliberately
            heavier heading weight on the page, matching the reference's own
            wordmark treatment for this nameplate. */}
        <div id="reels-heading" className="mb-4">
          <h2
            className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 flex items-center gap-2 text-[22px] font-black leading-none text-ink sm:text-[26px]`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px] flex-shrink-0 fill-brand sm:h-6 sm:w-6">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
            {t.heading}
          </h2>

          {channelUrl && (
            <Link
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.allAria}
              className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 no-underline transition-colors hover:text-ink"
            >
              <span aria-hidden className="text-[11px] leading-none rtl:rotate-0 ltr:rotate-180">
                ‹
              </span>
              {t.all}
            </Link>
          )}

          <div className="mt-3 flex h-[3px] overflow-hidden rounded-pill">
            <span aria-hidden className="h-full w-[100px] max-w-[38%] flex-shrink-0 bg-brand" />
            <span aria-hidden className="h-full flex-1 bg-line" />
          </div>
        </div>

        <ReelsLightbox lang={lang} reels={reels} t={t} />
      </div>
    </section>
  );
}
