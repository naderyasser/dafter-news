import Image from "next/image";
import Link from "next/link";

import { getSiteSettings, mediaUrl } from "@/lib/api";

/** Glyph and label per platform key — matches SocialLink.Platform. */
const SOCIAL_META: Record<string, { glyph: string; label: string }> = {
  facebook: { glyph: "f", label: "فيسبوك" },
  x: { glyph: "X", label: "X" },
  instagram: { glyph: "in", label: "إنستغرام" },
  youtube: { glyph: "▶", label: "يوتيوب" },
  tiktok: { glyph: "🎵", label: "تيك توك" },
  threads: { glyph: "🧵", label: "Threads" },
};

export default async function SiteFooter({ lang }: { lang: "ar" | "en" }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  const sectionLinks = isAr
    ? [
        { label: "مصر", href: "/section/egypt" },
        { label: "اقتصاد", href: "/section/economy" },
        { label: "رياضة", href: "/section/sports" },
        { label: "بالعقل والمنطق", href: "/opinion" },
        { label: "لقطة وتعليق", href: "/video" },
      ]
    : // These pointed at "#" while their Arabic counterparts were real routes,
      // so the English footer was eight dead links.
      [
        { label: "Egypt", href: "/en/section/egypt" },
        { label: "Markets", href: "/en/section/economy" },
        { label: "Sports", href: "/en/section/sports" },
        { label: "Opinion", href: "/en/section/opinion" },
        { label: "Watch", href: "/video" },
      ];

  const companyLinks = isAr
    ? [
        { label: "من نحن", href: "/about" },
        { label: "كتّابنا", href: "/authors" },
        { label: "الأكثر قراءة", href: "/most-read" },
      ]
    : [
        { label: "About", href: "/about" },
        { label: "Our writers", href: "/authors" },
        { label: "Most read", href: "/most-read" },
      ];

  // These four used to be hardcoded glyphs pointing at "#". They now come from
  // Settings → روابط التواصل; a platform with no URL saved simply doesn't
  // render, so the row never shows a dead link.
  const settings = await getSiteSettings();
  const logoSrc = mediaUrl(settings?.logo);
  const socials = (settings?.social_links ?? [])
    .filter((l) => l.url && SOCIAL_META[l.platform])
    .map((l) => ({ ...l, ...SOCIAL_META[l.platform] }));

  return (
    <footer className={`${fontBody} bg-header-bg pb-[52px]`} dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-container flex-wrap gap-10 px-6 pb-6 pt-12">
        <div className="min-w-[220px] flex-[2_1_260px]">
          {/* Same brand mark as the masthead (Settings → الشعار), sat on a
              paper chip — the uploaded logo is tuned for a light background,
              and this panel is the one dark surface it has to sit on. Falls
              back to the typographic wordmark when no logo is uploaded. */}
          {logoSrc ? (
            <span className="inline-flex rounded-[10px] bg-paper px-3.5 py-2.5">
              <Image src={logoSrc} alt={isAr ? "الدفتر مصر" : "Al Daftar Masr"} width={200} height={60} className="h-[36px] w-auto object-contain" />
            </span>
          ) : (
            <div className={`${fontDisplay} inline-flex items-center rule-accent rule-on-dark ps-3.5 text-[20px] font-extrabold text-header-ink`}>
              {isAr ? "الدفتر نيوز" : "Al Daftar News"}
            </div>
          )}
          <p className="my-4 max-w-[320px] text-[14px] leading-[1.7] text-header-muted">
            {isAr ? "سِجلّ اليوم.. خبراً خبراً" : "Today's record, story by story."}
          </p>
          {socials.length > 0 && (
            <div className="flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-ink-2 text-[13px] font-bold text-header-ink no-underline hover:border-brand hover:text-brand"
                >
                  {s.glyph}
                </a>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-[160px] flex-1">
          <div className={`${fontDisplay} mb-4 rule-accent rule-on-dark ps-2.5 text-[15px] font-bold text-header-ink`}>
            {isAr ? "الأقسام" : "Sections"}
          </div>
          <div className="flex flex-col gap-2.5">
            {sectionLinks.map((l) => (
              <Link key={l.label} href={l.href} className="text-[14px] text-header-muted no-underline hover:text-header-ink">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="min-w-[160px] flex-1">
          <div className={`${fontDisplay} mb-4 rule-accent rule-on-dark ps-2.5 text-[15px] font-bold text-header-ink`}>
            {isAr ? "الشركة" : "Company"}
          </div>
          <div className="flex flex-col gap-2.5">
            {companyLinks.map((l) => (
              <Link key={l.label} href={l.href} className="text-[14px] text-header-muted no-underline hover:text-header-ink">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-ink-2">
        <div className="mx-auto flex max-w-container flex-wrap justify-between gap-2 px-6 py-4">
          <span className="text-[13px] text-ink-3">© 2026 aldaftarnews.com</span>
          {/* Required by the keyless ExchangeRate-API Open Access tier that the
              currency ticker runs on. It sits in the footer because the ticker
              is site-wide; their terms allow the link to be discreet. */}
          <a
            href="https://www.exchangerate-api.com"
            rel="noopener"
            className="text-[13px] text-ink-3 no-underline hover:text-header-ink"
          >
            {isAr ? "أسعار الصرف من Exchange Rate API" : "Rates By Exchange Rate API"}
          </a>
          <span className="text-[13px] text-ink-3">
            {isAr ? "الدفتر نيوز © جميع الحقوق محفوظة" : "Al Daftar News — all rights reserved"}
          </span>
        </div>
      </div>
    </footer>
  );
}
