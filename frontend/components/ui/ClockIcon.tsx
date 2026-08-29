/**
 * The stroked clock that marks a publish time.
 *
 * One glyph, shared: five blocks had defined this same SVG privately —
 * byte-identical, down to the 1.6 stroke — which is five places to edit when
 * the mark changes and five chances for one of them to drift and quietly
 * teach a reader that two different clocks mean two different things.
 *
 * `aria-hidden` because the time beside it already says what it is; a screen
 * reader gains nothing from "clock, منذ ساعة".
 */
export default function ClockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3.3 1.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
