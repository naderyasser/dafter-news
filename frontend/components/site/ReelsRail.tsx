import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";

export type ReelCard = {
  id: number;
  title: string;
  thumbnail?: string | null;
  /** The card's own watch page — /reel/<slug> or /en/reel/<slug>, built by
   *  the caller (the homepage's own card mapper), same as every other card
   *  type on this site builds its own href rather than this component
   *  reconstructing one from a slug + lang combination. */
  href: string;
};

export const REEL_COPY = {
  ar: {
    heading: "حصل إيه؟",
    all: "المزيد",
    allAria: "المزيد من الريلز — يفتح فيسبوك في تبويب جديد",
    slot: "لقطة",
    watch: "شاهد",
    rail: "ريلز فيسبوك",
    recommended: "رشحنا لك",
  },
  en: {
    heading: "Catch Up",
    all: "More",
    allAria: "More reels — opens Facebook in a new tab",
    slot: "Reel",
    watch: "Watch",
    rail: "Facebook reels",
    recommended: "Recommended for you",
  },
};

/**
 * Exported for app/reel/[slug]'s own "رشحنا لك" strip, so a reader sees the
 * (near-)identical card there as on the home page rail.
 *
 * `tone` is the one real difference between the two surfaces: the home page
 * rail sits on the light «حصل إيه؟» band now (see ReelsRail's own docstring
 * for why), but the watch page's own strip stays on the dark player-page
 * band it always has, so the card's own body — the caption underneath the
 * poster — needs to read correctly on either. The poster itself (the image,
 * the play mark, the platform badge) is untouched by `tone`: that glass and
 * shadow treatment was built to hold up against an unpredictable PHOTOGRAPH
 * underneath it, which has nothing to do with which page it's sitting on.
 */
export function ReelPoster({
  lang,
  reel,
  t,
  tone = "dark",
}: {
  lang: "ar" | "en";
  reel: ReelCard;
  t: (typeof REEL_COPY)["ar"];
  tone?: "light" | "dark";
}) {
  const isAr = lang === "ar";
  const onLight = tone === "light";

  return (
    <Link
      href={reel.href}
      aria-label={`${t.watch}: ${reel.title}`}
      className={`reel-card group block w-[186px] overflow-hidden rounded-card border no-underline sm:w-[212px] ${
        onLight ? "border-line bg-paper" : "border-white/10 bg-board-stage"
      }`}
    >
      <div className="relative aspect-[9/16] overflow-hidden bg-board-stage">
        <CoverImage
          src={reel.thumbnail ?? undefined}
          alt=""
          placeholder={t.slot}
          // `board.stage` is #0A0A0B — deliberately dark regardless of
          // `tone`, on either surface: this is a photo's own empty-slot
          // placeholder, not page chrome, and reads correctly on both the
          // light rail and the dark watch-page strip the same way an
          // unloaded photo placeholder does everywhere else on the site.
          placeholderClassName="bg-navy-2 text-navy-tint"
          sizes="212px"
          className="absolute inset-0 transition-transform duration-med ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />

        {/* The play mark. `aria-hidden`, because the link's own accessible
            name already says what pressing this does.

            Smoked glass rather than lit glass: a white wash over a bright
            frame left the triangle floating on nothing, and a reel's poster
            is far more often a lit face than a dark one. The hairline ring
            is what keeps the disc's edge findable on a genuinely dark
            thumbnail, where a 30% black wash has almost nothing to darken. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-3 ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-med ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[1px] fill-paper" role="presentation">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
          </svg>
        </span>

        {/* What platform this plays through. `end-2` not `right-2`, so it
            mirrors with the page. */}
        <span
          aria-hidden
          className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-board-stage/70 backdrop-blur-sm"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-paper" role="presentation">
            <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.54-1.5H16.7V3.63A21 21 0 0 0 14.3 3.5c-2.37 0-4 1.45-4 4.11V9.9H7.6V13h2.7v8Z" />
          </svg>
        </span>
      </div>

      {/*
        The title lives in the card's own body below the poster, rather than
        as a gradient overlay on top of it — the editorial-grid layout the
        client's own reference showed: a clean image, and a caption
        underneath it in the card's body. A block in normal flow can only
        ever be as tall as its own line-clamped content, so this shape of
        card cannot reproduce the overflow bug an overlay title once had —
        there is no separate fixed-height layer for a long headline to
        disagree with.
      */}
      <div className="p-3">
        <h3
          className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 line-clamp-2 text-[13px] font-bold leading-[1.5] ${
            onLight ? "text-ink" : "text-paper"
          }`}
        >
          {reel.title}
        </h3>
      </div>
    </Link>
  );
}

/**
 * «حصل إيه؟» — an editorial reels rail. Pressing a card navigates to that
 * reel's own watch page (/reel/<slug>), which is where the actual player,
 * the muted-sound hint, the honest Share/"engage on Facebook" actions and
 * the «رشحنا لك» strip all live now — see app/reel/[slug]/page.tsx and its
 * English counterpart.
 *
 * Light-themed, on purpose, unlike the rest of the media desk («لقطة
 * وتعليق»'s own dark identity, and the watch page's own dark player band):
 * this is a deliberate, scoped exception the client asked for by name to
 * match a competitor's own light reels shelf, not a drift away from the
 * site's dark-media convention. It stays scoped to exactly this component —
 * `ReelPoster` takes an explicit `tone` for this reason, defaulting to
 * `"dark"` so the watch page's own reuse of the same card needs no changes
 * at all to keep its existing dark band.
 *
 * This component itself carries no player, no iframe and no client-side
 * state. It is a plain server component: a poster, a caption and an SVG per
 * card, the same footprint a plain photo-and-headline card would cost.
 *
 * It replaces the old «لقطة وتعليق» strip on the home page and sits right
 * after «سياسة» now, ahead of every other curated desk — the client's own
 * placement call, mirroring how prominently the reference treats it. The
 * /video desk itself is untouched and still runs at its own route.
 *
 * The rail scrolls horizontally with `snap-x`, which is the shape a shorts
 * shelf has everywhere a reader has already met one, and needs no arrows: it
 * is a native scroller, so a trackpad, a touch drag and a keyboard tab all
 * move it without any script of ours. The header's own "المزيد" link is a
 * companion to that, not a substitute for it.
 */
export default function ReelsRail({
  lang,
  reels,
  facebookUrl,
}: {
  lang: "ar" | "en";
  reels: ReelCard[];
  /** The paper's own page — the header's own «المزيد» link opens this. */
  facebookUrl?: string;
}) {
  if (reels.length === 0) return null;
  const isAr = lang === "ar";
  const t = isAr ? REEL_COPY.ar : REEL_COPY.en;

  return (
    <section className="bg-paper py-8" aria-labelledby="reels-heading">
      <div className="mx-auto max-w-container px-6">
        {/*
          The editorial-rail header from the client's own reference: a bold
          nameplate with a play mark beside it, a lighter "المزيد" link
          directly under it pointing at the paper's Facebook page, and a
          two-tone accent bar beneath both — brand red on the third nearer
          the title, a neutral tint filling the rest, mirroring automatically
          with the page's own `dir` since it is built as a plain flex row
          (the first child sits at the reading start in either direction)
          rather than anything physically left/right.

          `font-black` (900) rather than this site's usual `font-extrabold`
          (800) headings — the one deliberately heavier weight on the page,
          matching the reference's own especially bold wordmark treatment
          for this one nameplate.

          Not `SectionHeading` (the tinted-pill nameplate every OTHER block
          on the page uses): the reference's own header reads as a bold
          wordmark with its own "more" link directly under it, not a chip,
          and building that pairing needs its own markup rather than
          reusing a component that renders one plain heading and nothing
          beside it.
        */}
        <div id="reels-heading" className="mb-4">
          <h2
            className={`${isAr ? "font-display-ar" : "font-display-en"} m-0 flex items-center gap-2 text-[22px] font-black leading-none text-ink sm:text-[26px]`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px] flex-shrink-0 fill-brand sm:h-6 sm:w-6">
              <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
            </svg>
            {t.heading}
          </h2>

          {facebookUrl && (
            <Link
              href={facebookUrl}
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

          {/* The bar itself: two flex children, no physical left/right
              anywhere — `dir` on the page flips which side each one lands
              on for free. `line`, not the on-dark white/15 this carried on
              the old dark band — that neutral would have been all but
              invisible against paper. */}
          <div className="mt-3 flex h-[3px] overflow-hidden rounded-pill">
            <span aria-hidden className="h-full w-[100px] max-w-[38%] flex-shrink-0 bg-brand" />
            <span aria-hidden className="h-full flex-1 bg-line" />
          </div>
        </div>

        {/*
          `scrollbar-none` hides the bar, not the scrolling: the rail is still
          a real overflow container, so it keeps its keyboard and wheel
          behaviour. `-mx-6 px-6` lets the first and last card sit flush with
          the container gutter while the scroll region runs edge to edge, so
          nothing looks clipped at either end.
        */}
        <ul
          aria-label={t.rail}
          className="scrollbar-none -mx-6 m-0 flex gap-4 overflow-x-auto snap-x snap-mandatory list-none px-6 pb-1"
        >
          {reels.map((reel) => (
            <li key={reel.id} className="shrink-0 snap-start">
              <ReelPoster lang={lang} reel={reel} t={t} tone="light" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
