import Link from "next/link";

import CoverImage from "@/components/ui/CoverImage";

/** One card in the «حصل إيه؟» rail, and in the watch page's «رشحنا لك» strip. */
export type ReelCard = {
  id: number;
  title: string;
  thumbnail?: string | null;
  /** The card's own watch page — /reel/<slug> or /en/reel/<slug>, built by
   *  the caller, same as every other card type on this site builds its own
   *  href rather than reconstructing one from a slug + lang combination. */
  href: string;
  /** What the lightbox embeds. Every reel the public API returns has one. */
  youtubeId: string;
};

export const REEL_COPY = {
  ar: {
    heading: "حصل إيه؟",
    all: "المزيد",
    allAria: "المزيد من الريلز — يفتح قناة الدفتر على يوتيوب في تبويب جديد",
    slot: "لقطة",
    watch: "شاهد",
    rail: "ريلز يوتيوب",
    recommended: "رشحنا لك",
    player: "مشغّل الريلز",
    close: "إغلاق",
    prev: "السابق",
    next: "التالي",
    openPage: "صفحة الريل",
    onYoutube: "شاهد على يوتيوب",
    share: "مشاركة",
    shared: "تم نسخ الرابط",
  },
  en: {
    heading: "Catch Up",
    all: "More",
    allAria: "More reels — opens Al Daftar's YouTube channel in a new tab",
    slot: "Reel",
    watch: "Watch",
    rail: "YouTube reels",
    recommended: "Recommended for you",
    player: "Reels player",
    close: "Close",
    prev: "Previous",
    next: "Next",
    openPage: "Reel page",
    onYoutube: "Watch on YouTube",
    share: "Share",
    shared: "Link copied",
  },
};

export type ReelCopy = (typeof REEL_COPY)["ar"];

/** The YouTube play-button glyph — the platform badge on every poster. */
export function YoutubeGlyph({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="presentation" aria-hidden>
      <path
        fill="currentColor"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"
      />
    </svg>
  );
}

/**
 * A reel's poster card: the 9:16 picture, a play mark, the platform badge,
 * and the title in the card's own body underneath.
 *
 * It is a real link to the reel's own page, always — that is what a crawler
 * indexes, what a reader with scripts off gets, and what a middle-click
 * opens. When `onOpen` is given (the home page rail), a plain left click is
 * intercepted and opens the lightbox player on the same page instead of
 * navigating; modifier clicks fall through to the link.
 *
 * `tone` is the one real difference between its two surfaces: the home page
 * rail sits on a light band, the watch page's own «رشحنا لك» strip on the
 * dark player band, so the card's body has to read on either. The poster
 * itself (the image, the play mark, the badge) is untouched by `tone` —
 * that treatment was built to hold up against an unpredictable photograph.
 */
export function ReelPoster({
  lang,
  reel,
  t,
  tone = "dark",
  onOpen,
}: {
  lang: "ar" | "en";
  reel: ReelCard;
  t: ReelCopy;
  tone?: "light" | "dark";
  onOpen?: () => void;
}) {
  const isAr = lang === "ar";
  const onLight = tone === "light";

  return (
    <Link
      href={reel.href}
      aria-label={`${t.watch}: ${reel.title}`}
      onClick={
        onOpen
          ? (e) => {
              if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              onOpen();
            }
          : undefined
      }
      className={`reel-card group block w-[186px] overflow-hidden rounded-card border no-underline sm:w-[212px] ${
        onLight ? "border-line bg-paper" : "border-white/10 bg-board-stage"
      }`}
    >
      <div className="relative aspect-[9/16] overflow-hidden bg-board-stage">
        <CoverImage
          src={reel.thumbnail ?? undefined}
          alt=""
          placeholder={t.slot}
          // Deliberately dark regardless of `tone`: this is a photo's own
          // empty-slot placeholder, not page chrome.
          placeholderClassName="bg-navy-2 text-navy-tint"
          sizes="212px"
          className="absolute inset-0 transition-transform duration-med ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />

        {/* The play mark. `aria-hidden`, because the link's own accessible
            name already says what pressing this does. Smoked glass with a
            hairline ring so it stays findable on both a lit face and a
            genuinely dark frame. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-3 ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-med ease-out group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-[1px] fill-paper" role="presentation">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
          </svg>
        </span>

        {/* What platform this plays through. `end-2` so it mirrors with the page. */}
        <span
          aria-hidden
          className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-board-stage/70 text-paper backdrop-blur-sm"
        >
          <YoutubeGlyph />
        </span>
      </div>

      {/* The title lives in the card's own body below the poster rather than
          overlaid on it: a block in normal flow can only ever be as tall as
          its own line-clamped content, so a long headline can never overflow
          a fixed-height overlay layer. */}
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
