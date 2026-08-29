import Image from "next/image";
import Link from "next/link";

import { ThreadsGlyph } from "@/components/ui/BrandIcons";
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

/**
 * Brand icon + colour per platform key — matches SocialLink.Platform.
 *
 * `badgeClassName` overrides the shared white badge background: Instagram's
 * mark is a plain white glyph that needs its own gradient tile to read as
 * Instagram rather than a blank white square, so it carries the gradient
 * itself instead of an embedded SVG `<linearGradient>` — that render
 * inconsistently (it came back solid black in one renderer during testing),
 * where a CSS gradient on the container is reliable everywhere.
 */
const SOCIAL_META: Record<
  string,
  { label: string; Icon: (p: { className?: string }) => React.ReactElement; badgeClassName?: string }
> = {
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
  // Imported rather than re-declared inline: this file and BrandIcons.tsx
  // each carried their own copy of the Threads path, which is exactly how
  // two "identical" icons drift into two different marks. One definition,
  // used by both the footer badge and the article share row.
  threads: {
    label: "Threads",
    Icon: ThreadsGlyph,
  },
  instagram: {
    label: "إنستغرام",
    // A CSS gradient on the badge itself (see badgeClassName below), so the
    // glyph only needs to be a plain white shape on top of it.
    badgeClassName: "bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] border-transparent",
    Icon: ({ className }) => (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          fill="#fff"
          d="M12 0C8.74 0 8.333.014 7.053.072 5.775.13 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.014 8.333 0 8.74 0 12s.014 3.667.072 4.947c.058 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.986 8.74 24 12 24s3.667-.014 4.947-.072c1.277-.058 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.058-1.28.072-1.687.072-4.947s-.014-3.667-.072-4.947c-.058-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.5-2.913-.558C15.667.014 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 0 1-.899 1.382c-.42.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.81 3.81 0 0 1-1.379-.899c-.421-.42-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.532.505-.905.9-1.396.394-.475.775-.741 1.375-1.008.42-.164 1.05-.36 2.22-.42 1.269-.05 1.649-.065 4.859-.065l.045.045zM12 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"
        />
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
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors duration-fast hover:border-brand ${
                  s.badgeClassName ?? "border-ink-2 bg-paper"
                }`}
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
          <span className="text-[13px] text-ink-3">
            {isAr ? "تطوير " : "Built by "}
            <a
              href="https://master.dev.educore.software/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink-3 no-underline hover:text-header-ink"
            >
              Master Development
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
