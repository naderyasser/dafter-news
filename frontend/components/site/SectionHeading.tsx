import Link from "next/link";

/**
 * Section heading carrying the notebook-margin rule plus a "more" arrow
 * (the «أمريكا ›» pattern). The chevron mirrors in RTL so it always points
 * away from the text, i.e. onward.
 */
export default function SectionHeading({
  lang,
  title,
  href,
  moreLabel,
  tone = "light",
}: {
  lang: "ar" | "en";
  title: string;
  href?: string;
  moreLabel?: string;
  tone?: "light" | "dark";
}) {
  const isAr = lang === "ar";
  const onDark = tone === "dark";

  const heading = (
    <span
      className={`${isAr ? "font-display-ar" : "font-display-en"} border-s-[3px] border-brand ps-3 text-h2 font-extrabold ${
        onDark ? "text-paper" : "text-ink"
      }`}
    >
      {title}
    </span>
  );

  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      {href ? (
        <Link href={href} className="no-underline">
          {heading}
        </Link>
      ) : (
        heading
      )}

      {href ? (
        <Link
          href={href}
          className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-bold no-underline transition-colors duration-fast ${
            onDark ? "text-header-muted hover:text-paper" : "text-ink-3 hover:text-brand"
          }`}
        >
          {moreLabel ?? (isAr ? "المزيد" : "More")}
          <span className={`text-[15px] leading-none ${isAr ? "" : "-scale-x-100"}`}>›</span>
        </Link>
      ) : null}
    </div>
  );
}
