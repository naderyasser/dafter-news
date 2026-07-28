/**
 * Route-level loading UI (Next.js `loading.tsx` boundaries).
 *
 * Every public page is an async Server Component doing its own data fetch —
 * without a loading.tsx, the browser shows nothing at all between a click
 * and the fetch resolving, which reads as the site having frozen rather
 * than having registered the click. These give App Router something to
 * stream in immediately: the chrome shape plus a content skeleton that
 * roughly matches what's coming, so the transition feels instant even when
 * the fetch behind it isn't.
 *
 * The chrome itself still "pops in" once the real header mounts (SiteShell
 * is called from inside each page rather than a shared layout), but a
 * shaped placeholder beats a blank tab every time.
 */

const pulse = "animate-skeleton bg-surface-2";

function ChromeSkeleton({ lang }: { lang: "ar" | "en" }) {
  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className={`h-9 ${pulse}`} />
      <div className="border-b border-line bg-paper px-6 py-4">
        <div className="mx-auto flex max-w-container items-center gap-4">
          <div className={`h-10 w-10 flex-shrink-0 rounded ${pulse}`} />
          <div className={`h-[52px] w-32 flex-shrink-0 rounded ${pulse}`} />
          <div className={`ms-auto h-10 w-40 rounded-pill ${pulse}`} />
        </div>
      </div>
      <div className="border-b border-line bg-paper px-6 py-3">
        <div className="mx-auto flex max-w-container gap-6">
          {[20, 16, 24, 18, 16, 20].map((w, i) => (
            <div key={i} className={`h-4 rounded ${pulse}`} style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-paper ${pulse}`}>
      <div className="aspect-video bg-surface-2" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="h-3 w-1/3 rounded bg-surface-2" />
        <div className="h-4 w-full rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
      </div>
    </div>
  );
}

/** Home: hero + side rail + a couple of card rows. */
function HomeBody() {
  return (
    <div className="mx-auto max-w-container px-6 py-6">
      <div className="mb-6 flex flex-wrap gap-5">
        <div className={`aspect-[2/1] min-w-0 flex-[2_1_480px] rounded-card ${pulse}`} />
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-24 rounded-card ${pulse}`} />
          ))}
        </div>
      </div>
      <div className={`mb-4 h-6 w-40 rounded ${pulse}`} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** A single article/video/opinion piece: kicker, headline, meta, hero, body lines. */
function ArticleBody() {
  return (
    <div className="mx-auto max-w-reading px-6 py-8">
      <div className="flex flex-col gap-4">
        <div className={`h-4 w-24 rounded ${pulse}`} />
        <div className={`h-9 w-full rounded ${pulse}`} />
        <div className={`h-9 w-4/5 rounded ${pulse}`} />
        <div className={`h-4 w-32 rounded ${pulse}`} />
        <div className={`aspect-[16/9] w-full rounded-card ${pulse}`} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`h-4 rounded ${pulse}`} style={{ width: `${92 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Section/tag/search/most-read/authors and similar listing pages. */
function ListBody() {
  return (
    <div className="mx-auto max-w-container px-6 py-8">
      <div className={`mb-6 h-8 w-56 rounded ${pulse}`} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

const BODIES = { home: HomeBody, article: ArticleBody, list: ListBody };

export default function PageSkeleton({ lang = "ar", variant = "list" }: { lang?: "ar" | "en"; variant?: keyof typeof BODIES }) {
  const Body = BODIES[variant];
  return (
    <div aria-hidden className="min-h-screen bg-surface">
      <ChromeSkeleton lang={lang} />
      <Body />
    </div>
  );
}
