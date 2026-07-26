import Link from "next/link";

import NavDrawer from "@/components/site/NavDrawer";
import PrayerStrip from "@/components/site/PrayerStrip";
import BreakingAlertsToggle from "@/components/site/BreakingAlertsToggle";
import SearchBox from "@/components/site/SearchBox";
import { getBreakingNews, getPrayerTimes, getSections, getSiteSettings, mediaUrl } from "@/lib/api";

type NavItem = { key: string; label: string; href: string };

const NAV_EN: NavItem[] = [
  { key: "home", label: "Home", href: "/en" },
  { key: "egypt", label: "Egypt", href: "#" },
  { key: "economy", label: "Economy", href: "#" },
  { key: "sports", label: "Sports", href: "#" },
  { key: "opinion", label: "Opinion", href: "#" },
  { key: "video", label: "Watch", href: "#" },
  { key: "live", label: "Live", href: "/live" },
  { key: "markets", label: "Markets", href: "#" },
];

export default async function SiteHeader({ lang, active = "" }: { lang: "ar" | "en"; active?: string }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const homeHref = isAr ? "/" : "/en";
  const altLangHref = isAr ? "/en" : "/";

  const [breakingRes, sectionsRes, prayer, settings] = await Promise.all([
    getBreakingNews(),
    getSections(),
    getPrayerTimes(),
    getSiteSettings(),
  ]);
  const logoSrc = mediaUrl(settings?.logo);
  const breaking = breakingRes;
  const sections = sectionsRes.results;

  // The nav bar shows the sections themselves; «لقطة وتعليق» was dropped from
  // the masthead buttons on request, so it lives here with the rest.
  const nav: NavItem[] = isAr
    ? [{ key: "home", label: "الرئيسية", href: "/" }, ...sections.map((s) => ({ key: s.key, label: s.name_ar, href: `/section/${s.key}` }))]
    : NAV_EN;

  const drawerExtras = isAr
    ? [
        { label: "الأسواق", href: "/markets" },
        { label: "بث مباشر", href: "/live" },
        { label: "الأكثر قراءة", href: "/most-read" },
        { label: "كتّاب الدفتر", href: "/authors" },
        { label: "من نحن", href: "/about" },
      ]
    : [
        { label: "Markets", href: "/markets" },
        { label: "Live", href: "/live" },
        { label: "About", href: "/about" },
      ];
  // BreakingNewsItem.text is a single column and every row in it is Arabic,
  // so the English masthead was running an Arabic marquee. Take only the rows
  // written in this page's script; when none match, the existing per-language
  // default below still gives the bar something to say.
  const breakingItems = breaking.results
    .map((b) => b.text)
    .filter((text) => /[؀-ۿ]/.test(text) === isAr);

  const breakingText = breakingItems.length
    ? breakingItems.join("   •   ")
    : isAr
      ? "الرئيس يفتتح المرحلة الثانية من محور الدلتا الجديد   •   البنك المركزي يثبّت أسعار الفائدة"
      : "President opens second phase of new Delta corridor   •   Central bank holds interest rates steady";

  const today = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div dir={isAr ? "rtl" : "ltr"} lang={lang} className={`${fontBody} sticky top-0 z-50`}>
      {/* topbar */}
      <div className="bg-header-bg text-[13px] text-header-muted">
        <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-4 px-6 py-1.5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="whitespace-nowrap text-header-ink">{today}</span>
            {isAr ? <PrayerStrip times={prayer} /> : null}
          </div>
          <div className="flex items-center gap-4">
            {/* The sign-in link was removed from the public chrome on request.
                /login still resolves directly, and /dashboard redirects there,
                so the newsroom route is unchanged — it just isn't advertised
                to readers any more. */}
            {/* No divider here: the alerts toggle decides on the client whether
                it can render at all, so a server-rendered separator would be
                left dangling in front of the language link. gap-4 carries it. */}
            {isAr ? <BreakingAlertsToggle /> : null}
            <Link href={altLangHref} className="text-[13px] font-semibold text-header-ink no-underline">
              {isAr ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </div>

      {/* masthead — hamburger at the inline start, search at the inline end */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-container items-center gap-4 px-6 py-4">
          <NavDrawer lang={lang} sections={sections} extraLinks={drawerExtras} />

          {/* The masthead shows the uploaded brand mark when Settings has one,
              and falls back to the typographic wordmark the design shipped
              with. Upload it at /dashboard/settings — no code change needed to
              swap it later. */}
          <Link href={homeHref} className="flex flex-shrink-0 items-center no-underline">
            {logoSrc ? (
              // Sized by height so any future mark keeps its own proportions;
              // the supplied file is trimmed to the ink, so this is all logo
              // rather than the white field the original JPEG carried.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={isAr ? "الدفتر مصر" : "Al Daftar Masr"}
                className="h-[52px] w-auto object-contain sm:h-[64px] lg:h-[72px]"
              />
            ) : (
              <span className={`${fontDisplay} flex flex-col border-s-[3px] border-brand ps-3`}>
                <span className="text-[22px] font-extrabold leading-tight tracking-[-0.3px] text-ink">
                  {isAr ? "الدفتر نيوز" : "Al Daftar News"}
                </span>
                <span className="text-[11px] font-semibold text-ink-3">
                  {isAr ? "سِجلّ اليوم.. خبراً خبراً" : "Today's record, story by story"}
                </span>
              </span>
            )}
          </Link>

          {/* The «بث مباشر» pill that used to sit here was removed on request;
              /live stays reachable from the nav row and the drawer. */}

          <div className="ms-auto flex min-w-0 items-center justify-end">
            <SearchBox lang={lang} sections={sections} />
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="border-b border-line bg-paper shadow-1">
        <div className="mx-auto flex h-11 max-w-container items-stretch gap-7 overflow-x-auto px-6">
          {nav.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex flex-shrink-0 items-center whitespace-nowrap border-b-[3px] px-1 text-[14px] no-underline ${
                  isActive ? "border-brand font-bold text-brand" : "border-transparent font-semibold text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* breaking marquee */}
      <div className="relative flex h-9 items-stretch overflow-hidden bg-badge-breaking">
        <span className="z-[2] flex flex-shrink-0 items-center bg-brand-strong px-3.5 text-[13px] font-extrabold text-paper">
          {isAr ? "عاجل" : "BREAKING"}
        </span>
        <div className="relative flex min-w-0 flex-1 items-center overflow-hidden">
          <div
            className={`group inline-flex whitespace-nowrap ps-6 text-[13px] font-semibold text-paper ${
              isAr ? "animate-marquee-rtl" : "animate-marquee-ltr"
            } hover:[animation-play-state:paused]`}
          >
            <span className="pe-12 whitespace-nowrap">{breakingText}</span>
            <span className="pe-12 whitespace-nowrap">{breakingText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
