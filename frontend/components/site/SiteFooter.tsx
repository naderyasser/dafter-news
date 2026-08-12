import Image from "next/image";
import Link from "next/link";

import { getSections, getSiteSettings, mediaUrl } from "@/lib/api";

const CONTACT_EMAIL = "aldaftarnews@gmail.com";
// wa.me takes digits only, no "+" and no spaces.
const WHATSAPP_NUMBER = "201035682002";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}`;

// «لقطة وتعليق» and «بالعقل والمنطق» live at their own routes, not
// /section/<key> — same mapping the old hardcoded footer list used.
const SECTION_HREF: Record<string, { ar: string; en: string }> = {
  video: { ar: "/video", en: "/video" },
  opinion: { ar: "/opinion", en: "/en/section/opinion" },
};

/** Brand icon + colour per platform key — matches SocialLink.Platform. */
const SOCIAL_META: Record<string, { label: string; Icon: (p: { className?: string }) => React.ReactElement }> = {
  facebook: {
    label: "فيسبوك",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <circle cx="12" cy="12" r="12" fill="#1877F2" />
        <path
          d="M15.6 8.9h-1.5c-.8 0-1 .4-1 1.1v1.5h2.5l-.3 2.5h-2.2V21h-2.6v-6.9H8.4v-2.5h2.1V9.7c0-2.1 1.2-3.5 3.4-3.5h1.7v2.7z"
          fill="#fff"
        />
      </svg>
    ),
  },
  x: {
    label: "X",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path d="M4 4l6.9 8.8L4.2 20h1.9l5.8-6.3L16.5 20H20l-7.2-9.2L19.2 4h-1.9l-5.4 5.8L8 4H4z" fill="currentColor" />
      </svg>
    ),
  },
  youtube: {
    label: "يوتيوب",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <rect x="1" y="5" width="22" height="14" rx="4.5" fill="#FF0000" />
        <path d="M10 8.7l6 3.3-6 3.3z" fill="#fff" />
      </svg>
    ),
  },
  threads: {
    label: "Threads",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          d="M12 2.2C6.7 2.2 3.4 5.7 3.4 12S6.7 21.8 12 21.8c4 0 7-1.9 8.1-5.4l-2.2-.7c-.8 2.4-2.7 3.7-5.6 3.7-3.3 0-5.5-1.9-5.9-5h13.3c.1-.5.1-1 .1-1.5 0-5.4-2.6-9.7-7.4-9.7zM8.6 10.9c.4-2.4 1.9-3.9 3.9-3.9 2.1 0 3.5 1.4 3.8 3.9H8.6z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  instagram: {
    label: "إنستغرام",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <defs>
          <linearGradient id="footerIgGrad" x1="0" y1="24" x2="24" y2="0">
            <stop offset="0" stopColor="#FEDA75" />
            <stop offset=".3" stopColor="#FA7E1E" />
            <stop offset=".6" stopColor="#D62976" />
            <stop offset=".8" stopColor="#962FBF" />
            <stop offset="1" stopColor="#4F5BD5" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="22" height="22" rx="6.5" fill="url(#footerIgGrad)" />
        <rect x="6.7" y="6.7" width="10.6" height="10.6" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.6" />
        <circle cx="17.4" cy="6.6" r="1.15" fill="#fff" />
      </svg>
    ),
  },
  tiktok: {
    label: "تيك توك",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          d="M16.6 2h-3.1v14.4c0 1.5-1.2 2.7-2.7 2.7s-2.7-1.2-2.7-2.7 1.2-2.7 2.7-2.7c.3 0 .6 0 .9.1v-3.2c-.3 0-.6-.1-.9-.1-3.2 0-5.9 2.6-5.9 5.9S7.6 22.3 10.8 22.3s5.9-2.6 5.9-5.9V8.7c1.2.9 2.8 1.4 4.4 1.4V7c-1.9 0-3.6-1.3-3.9-3.2-.1-.6-.1-1.2-.1-1.8z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

export default async function SiteFooter({ lang }: { lang: "ar" | "en" }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  const [settings, sections] = await Promise.all([getSiteSettings(), getSections()]);
  const logoSrc = mediaUrl(settings?.logo);

  // Every real section, in their dashboard order — a section added there
  // shows up here automatically instead of the footer quietly listing five
  // hardcoded ones forever.
  const sectionBoxes = sections.results.map((s) => {
    const mapped = SECTION_HREF[s.key];
    return {
      key: s.key,
      label: isAr ? s.name_ar : s.name_en || s.name_ar,
      href: mapped ? mapped[lang] : isAr ? `/section/${s.key}` : `/en/section/${s.key}`,
    };
  });

  const topLinks = [
    { label: isAr ? "للتواصل معنا" : "Contact us", href: `mailto:${CONTACT_EMAIL}` },
    { label: isAr ? "للإعلان معنا" : "Advertise with us", href: WHATSAPP_HREF },
  ];

  const socials = (settings?.social_links ?? [])
    .filter((l) => l.url && SOCIAL_META[l.platform])
    .map((l) => ({ ...l, ...SOCIAL_META[l.platform] }));

  return (
    <footer className={`${fontBody} bg-header-bg pb-[52px]`} dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-container px-6 pb-10 pt-14 text-center">
        {/* Same brand mark as the masthead (Settings → الشعار), sat on a
            paper chip — the uploaded file is navy-on-transparent, tuned for a
            light background, and this is the one dark surface it has to sit
            on. Falls back to the typographic wordmark when none is set. */}
        <div className="flex justify-center">
          {logoSrc ? (
            <span className="inline-flex rounded-[10px] bg-paper px-4 py-3">
              <Image src={logoSrc} alt={isAr ? "الدفتر مصر" : "Al Daftar Masr"} width={220} height={70} className="h-[56px] w-auto object-contain" />
            </span>
          ) : (
            <div className={`${fontDisplay} inline-flex items-center rule-accent rule-on-dark ps-3.5 text-[26px] font-extrabold text-header-ink`}>
              {isAr ? "الدفتر نيوز" : "Al Daftar News"}
            </div>
          )}
        </div>

        <p className="mt-5 text-[14px] font-semibold text-header-ink">
          {isAr ? "جميع الحقوق محفوظة للدفتر نيوز" : "All rights reserved to Al Daftar News"}
        </p>
        <p className="mt-1 text-[13px] text-header-muted" dir="ltr">
          aldaftarnews.com
        </p>

        <nav className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-[13px]">
          {topLinks.map((l, i) => (
            <span key={l.href} className="flex items-center gap-2.5">
              {i > 0 && (
                <span aria-hidden className="text-header-muted">
                  |
                </span>
              )}
              <a href={l.href} className="text-header-muted no-underline hover:text-header-ink">
                {l.label}
              </a>
            </span>
          ))}
        </nav>

        {sectionBoxes.length > 0 && (
          <div className="mt-10">
            <div className={`${fontDisplay} inline-flex rule-accent rule-on-dark ps-3.5 text-[16px] font-extrabold text-header-ink`}>
              {isAr ? "الأقسام" : "Sections"}
            </div>
            <div className="mx-auto mt-4 grid max-w-[640px] grid-cols-2 gap-3 sm:grid-cols-3">
              {sectionBoxes.map((s) => (
                <Link
                  key={s.key}
                  href={s.href}
                  className="rounded-lg border border-ink-2 px-4 py-3 text-[14px] font-semibold text-header-muted no-underline transition-colors duration-fast hover:border-brand hover:text-header-ink"
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10">
          <div className={`${fontDisplay} inline-flex rule-accent rule-on-dark ps-3.5 text-[16px] font-extrabold text-header-ink`}>
            {isAr ? "الشركة" : "Company"}
          </div>
          <div className="mx-auto mt-4 grid max-w-[360px] grid-cols-2 gap-3">
            <Link
              href="/about"
              className="rounded-lg border border-ink-2 px-4 py-3 text-[14px] font-semibold text-header-muted no-underline transition-colors duration-fast hover:border-brand hover:text-header-ink"
            >
              {isAr ? "من نحن" : "About"}
            </Link>
            <Link
              href="/most-read"
              className="rounded-lg border border-ink-2 px-4 py-3 text-[14px] font-semibold text-header-muted no-underline transition-colors duration-fast hover:border-brand hover:text-header-ink"
            >
              {isAr ? "الأكثر قراءة" : "Most read"}
            </Link>
          </div>
        </div>

        {socials.length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {socials.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label}
                title={s.label}
                className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-2 bg-paper transition-colors duration-fast hover:border-brand"
              >
                <s.Icon className="h-7 w-7 text-ink" />
              </a>
            ))}
          </div>
        )}
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
