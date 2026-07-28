/**
 * Directional chevron.
 *
 * An SVG, not a `›` / `←` character, and that is the entire point. Those
 * characters have Unicode's Bidi_Mirrored property, so a browser already
 * flips them when they resolve to RTL — and the codebase was *also* flipping
 * them with `-scale-x-100`. Two flips cancel, so half the arrows on the
 * Arabic site pointed backwards: «اقرأ الخبر ›» sent the eye to the right,
 * away from where the link goes. The remaining half compensated by not
 * flipping, which then broke the English edition instead.
 *
 * SVG geometry is never mirrored by the bidi algorithm, so one explicit rule
 * covers both editions: the path points inline-end, and `back` turns it
 * around.
 *
 * `forward` means onward in reading order — left in Arabic, right in
 * English — so callers say what they mean and never do the arithmetic.
 */
export default function Chevron({
  lang,
  dir = "forward",
  className = "",
}: {
  lang: "ar" | "en";
  dir?: "forward" | "back";
  className?: string;
}) {
  // The path is drawn pointing right. In Arabic, forward is left; in English,
  // back is left. Exactly one of those two conditions flips it.
  const flip = (lang === "ar") !== (dir === "back");

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      className={`${flip ? "-scale-x-100" : ""} ${className || "h-[1em] w-[1em]"}`}
    >
      <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
