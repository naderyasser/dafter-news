/**
 * «بث تجريبي» — the site-status badge beside the masthead logo.
 *
 * Shaped after الشرق's «مباشر» pill (a play glyph in a filled disc, then the
 * label) because the client pointed at it directly, but in الدفتر's own two
 * colours rather than الشرق's single red: the disc is brand red, the body is
 * the logo blue. That split is the point — a solid red pill beside a red
 * «عاجل» marquee reads as one more alert, and this is not an alert.
 *
 * It is a status, not a link, so it is a <span> with a title rather than a
 * button: there is nothing to click and nowhere to go. Remove the whole
 * element when the site leaves trial — it exists for the government and
 * security review, not for readers.
 */
export default function BetaBadge({ lang }: { lang: "ar" | "en" }) {
  const isAr = lang === "ar";

  return (
    <span
      className="flex flex-shrink-0 items-center gap-1.5 rounded-pill bg-accent-strong py-1 pe-3 ps-1 text-paper"
      title={isAr ? "الموقع قيد التشغيل التجريبي" : "The site is running in trial mode"}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand" aria-hidden>
        {/* The triangle mirrors in RTL so it always points the way the page
            reads, the same rule ArticleCard's video glyph follows. */}
        <span className={`text-[8px] leading-none ${isAr ? "-scale-x-100" : ""}`}>▶</span>
      </span>
      <span className="whitespace-nowrap text-[11px] font-extrabold sm:text-xs">
        {isAr ? "بث تجريبي" : "Beta"}
      </span>
    </span>
  );
}
