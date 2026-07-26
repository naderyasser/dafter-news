import Link from "next/link";

import SearchBox from "@/components/site/SearchBox";
import { getBreakingNews } from "@/lib/api";

type NavItem = { key: string; label: string; href: string };

const NAV_AR: NavItem[] = [
  { key: "home", label: "الرئيسية", href: "/" },
  { key: "egypt", label: "مصر", href: "/section/egypt" },
  { key: "economy", label: "اقتصاد", href: "/section/economy" },
  { key: "sports", label: "رياضة", href: "/section/sports" },
  { key: "opinion", label: "بالعقل والمنطق", href: "/opinion" },
  { key: "video", label: "لقطة وتعليق", href: "/video" },
  { key: "live", label: "بث مباشر", href: "/live" },
  { key: "markets", label: "الأسواق", href: "/markets" },
];

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
  const nav = isAr ? NAV_AR : NAV_EN;
  const homeHref = isAr ? "/" : "/en";
  const altLangHref = isAr ? "/en" : "/";
  const liveHref = "/live";

  const breaking = await getBreakingNews();
  const breakingText = breaking.results.length
    ? breaking.results.map((b) => b.text).join("   •   ")
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
          <div className="flex items-center gap-4">
            <span className="whitespace-nowrap text-header-ink">{today}</span>
            <span className="tnum flex items-center gap-1 whitespace-nowrap">☀ 34°</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[13px] text-header-muted no-underline hover:text-header-ink">
              {isAr ? "تسجيل الدخول" : "Log in"}
            </Link>
            <span className="h-3 w-px bg-ink-2" />
            <Link href={altLangHref} className="text-[13px] font-semibold text-header-ink no-underline">
              {isAr ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </div>

      {/* masthead */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-container flex-wrap items-center gap-5 px-6 py-4">
          <Link
            href={homeHref}
            className={`${fontDisplay} flex flex-shrink-0 items-center border-s-[3px] border-brand ps-3 text-[22px] font-extrabold tracking-[-0.3px] text-ink no-underline`}
          >
            {isAr ? "الدفتر نيوز" : "Al Daftar News"}
          </Link>
          <SearchBox lang={lang} />
          <Link
            href={liveHref}
            className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-pill bg-brand px-[18px] py-2.5 text-[14px] font-bold text-paper no-underline hover:bg-brand-strong"
          >
            <span className="h-2 w-2 flex-shrink-0 animate-pulse-dot rounded-full bg-paper" />
            {isAr ? "بث مباشر" : "Live now"}
          </Link>
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
