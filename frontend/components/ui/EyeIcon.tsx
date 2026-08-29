/**
 * The stroked eye that marks a read count.
 *
 * Sibling to ClockIcon, and deliberately built to the same spec — 24×24 box,
 * 1.6 stroke, currentColor — because the two appear in the same caption line
 * across the site. A mark drawn at a different weight beside it reads as a
 * different system's icon rather than a second fact about the same story.
 *
 * `aria-hidden` because the count beside it already says what it is: a screen
 * reader gains nothing from "eye, ١٥٠ قراءة", and the word «قراءة» carries
 * the meaning the glyph is only decorating.
 */
export default function EyeIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
