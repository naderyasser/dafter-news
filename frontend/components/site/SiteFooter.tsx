import Link from "next/link";

export default function SiteFooter({ lang }: { lang: "ar" | "en" }) {
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
    : [
        { label: "Egypt", href: "#" },
        { label: "Economy", href: "#" },
        { label: "Sports", href: "#" },
        { label: "Opinion", href: "#" },
        { label: "Watch", href: "#" },
      ];

  const companyLinks = isAr
    ? [
        { label: "من نحن", href: "/about" },
        { label: "كتّابنا", href: "/authors" },
        { label: "الأكثر قراءة", href: "/most-read" },
        { label: "تسجيل الدخول", href: "/login" },
      ]
    : [
        { label: "About", href: "#" },
        { label: "Contact", href: "#" },
        { label: "Privacy", href: "#" },
        { label: "Log in", href: "#" },
      ];

  const socials = ["f", "X", "in", "▶"];

  return (
    <footer className={`${fontBody} bg-header-bg pb-[52px]`} dir={isAr ? "rtl" : "ltr"}>
      <div className="mx-auto flex max-w-container flex-wrap gap-10 px-6 pb-6 pt-12">
        <div className="min-w-[220px] flex-[2_1_260px]">
          <div className={`${fontDisplay} inline-flex items-center border-s-[3px] border-brand ps-3 text-[20px] font-extrabold text-header-ink`}>
            {isAr ? "الدفتر نيوز" : "Al Daftar News"}
          </div>
          <p className="my-4 max-w-[320px] text-[14px] leading-[1.7] text-header-muted">
            {isAr ? "سِجلّ اليوم.. خبراً خبراً" : "Today's record, story by story."}
          </p>
          <div className="flex gap-2.5">
            {socials.map((s) => (
              <a
                key={s}
                href="#"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-ink-2 text-[13px] font-bold text-header-ink no-underline hover:border-brand hover:text-brand"
              >
                {s}
              </a>
            ))}
          </div>
        </div>
        <div className="min-w-[160px] flex-1">
          <div className={`${fontDisplay} mb-4 border-s-[3px] border-brand ps-2.5 text-[15px] font-bold text-header-ink`}>
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
          <div className={`${fontDisplay} mb-4 border-s-[3px] border-brand ps-2.5 text-[15px] font-bold text-header-ink`}>
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
