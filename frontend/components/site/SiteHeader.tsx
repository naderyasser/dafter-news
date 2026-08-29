import Image from "next/image";
import Link from "next/link";

import BetaBadge from "@/components/site/BetaBadge";
import NavDrawer from "@/components/site/NavDrawer";
import PrayerStrip from "@/components/site/PrayerStrip";
import BreakingAlertsToggle from "@/components/site/BreakingAlertsToggle";
import MainNav from "@/components/site/MainNav";
import SearchBox from "@/components/site/SearchBox";
import StickyHeader from "@/components/site/StickyHeader";
import { getBreakingNews, getPrayerTimes, getSections, getSiteSettings, mediaUrl } from "@/lib/api";

type NavItem = { key: string; label: string; href: string };

// The English nav was a hardcoded list of six labels pointing at "#", while
// the Arabic one listed every section from the API. Both are built the same
// way now, so switching language changes the words and the direction — not
// what the site is.

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
  const nav: NavItem[] = [
    { key: "home", label: isAr ? "الرئيسية" : "Home", href: homeHref },
    ...sections.map((s) => ({
      key: s.key,
      label: isAr ? s.name_ar : s.name_en || s.name_ar,
      href: isAr ? `/section/${s.key}` : `/en/section/${s.key}`,
    })),
  ];

  const drawerExtras = isAr
    ? [
        { label: "الأسواق", href: "/markets" },
        { label: "الأكثر قراءة", href: "/most-read" },
        { label: "كتّاب الدفتر", href: "/authors" },
        { label: "من نحن", href: "/about" },
      ]
    : [
        { label: "Markets", href: "/markets" },
        { label: "About", href: "/about" },
      ];
  // BreakingNewsItem.text is a single column and every row in it is Arabic,
  // so the English masthead was running an Arabic marquee. Take only the rows
  // written in this page's script; when none match, the per-language default
  // below still gives the bar something to say. Each row keeps its href so
  // the strip is a set of links to the stories, not decoration.
  const matching = breaking.results.filter((b) => /[؀-ۿ]/.test(b.text) === isAr);
  const tickerItems: { text: string; href: string }[] = matching.length
    ? matching.map((b) => ({ text: b.text, href: b.href || "" }))
    : isAr
      ? [
          { text: "الرئيس يفتتح المرحلة الثانية من محور الدلتا الجديد", href: "" },
          { text: "البنك المركزي يثبّت أسعار الفائدة", href: "" },
        ]
      : [
          { text: "President opens second phase of new Delta corridor", href: "" },
          { text: "Central bank holds interest rates steady", href: "" },
        ];

  const today = new Intl.DateTimeFormat(isAr ? "ar-EG" : "en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  // Three siblings rather than one sticky block: on phones the full stack
  // (topbar + masthead + five wrapped nav rows + marquee) was pinned to the
  // top and left the reader a letterbox of actual page. Only the masthead and
  // nav stay sticky now; the date bar and the «عاجل» marquee scroll away with
  // the page like any other content.
  return (
    <div dir={isAr ? "rtl" : "ltr"} lang={lang} className={`${fontBody} contents`}>
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

      <StickyHeader>
      {/* masthead — hamburger at the inline start, search at the inline end */}
      <div className="border-b border-line bg-paper">
        {/* py-2 and a 44px mark: the masthead was 104px on its own (py-4 plus a
            72px logo), which alone blew most of the ~110px budget the whole
            sticky block is allowed. */}
        <div className="mx-auto flex max-w-container items-center gap-4 px-6 py-2">
          <NavDrawer lang={lang} sections={sections} extraLinks={drawerExtras} active={active} logoSrc={logoSrc} />

          {/* The masthead shows the uploaded brand mark when Settings has one,
              and falls back to the typographic wordmark the design shipped
              with. Upload it at /dashboard/settings — no code change needed to
              swap it later. */}
          <Link href={homeHref} className="flex flex-shrink-0 items-center no-underline">
            {logoSrc ? (
              // Sized by height so any future mark keeps its own proportions;
              // the supplied file is trimmed to the ink, so this is all logo
              // rather than the white field the original JPEG carried.
              <Image
                src={logoSrc}
                alt={isAr ? "الدفتر مصر" : "Al Daftar Masr"}
                width={240}
                height={72}
                priority
                className="h-[38px] w-auto object-contain sm:h-[42px] lg:h-[46px]"
              />
            ) : (
              <span className={`${fontDisplay} rule-accent flex flex-col ps-3.5`}>
                <span className="text-[22px] font-extrabold leading-tight tracking-[-0.3px] text-ink">
                  {isAr ? "الدفتر نيوز" : "Al Daftar News"}
                </span>
                <span className="text-[11px] font-semibold text-ink-3">
                  {isAr ? "سِجلّ اليوم.. خبراً خبراً" : "Today's record, story by story"}
                </span>
              </span>
            )}
          </Link>

          {/* Site status, not a content label — the newsroom is publishing
              while the build is still settling, so readers are told up front.
              Sits beside the mark rather than in the topbar so it can't be
              mistaken for one of the utility links. Remove this block when the
              site goes fully live. */}
          <BetaBadge lang={lang} />

          <div className="ms-auto flex min-w-0 items-center justify-end">
            <SearchBox lang={lang} sections={sections} />
          </div>
        </div>
      </div>

      {/* nav — the active item is underlined in its own section's colour, so
          the bar reads as part of the section you are standing in rather than
          as one more red element competing with «عاجل» below it.

          One line at every desktop width: MainNav measures the bar and moves
          the tail into a «المزيد ⌄» menu rather than wrapping to a second
          row, which is what pushed the sticky chrome to 190px. */}
      <MainNav items={nav} active={active} />
      </StickyHeader>

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
            {/* Two copies keep the loop seamless; the second is hidden from
                assistive tech so nothing is announced twice. Items with an
                href are links straight to the story — the client's ask. */}
            {[0, 1].map((copy) => (
              <span key={copy} aria-hidden={copy === 1} className="inline-flex whitespace-nowrap">
                {tickerItems.map((item, i) => (
                  <span key={i} className="inline-flex items-center whitespace-nowrap">
                    {item.href ? (
                      <Link href={item.href} className="whitespace-nowrap text-paper no-underline hover:underline">
                        {item.text}
                      </Link>
                    ) : (
                      <span className="whitespace-nowrap">{item.text}</span>
                    )}
                    <span aria-hidden className="px-5 text-paper/60">
                      •
                    </span>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
