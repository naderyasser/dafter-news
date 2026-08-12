/**
 * Single-colour brand glyphs — `fill="currentColor"`, no background baked
 * in, so a caller supplies its own colour via `className` (text-*) and
 * whatever container shape/background it wants (a circle, a square...).
 *
 * Each path is rasterized (`convert path.svg path.png`) and checked by eye
 * before use, not just visually skimmed in an editor — a hand-typed path is
 * easy to get subtly wrong, and the previous ThreadsGlyph is exactly that
 * lesson: it read as plausible SVG and even carried a comment claiming it
 * had been checked, but it actually rendered as an unrecognizable blob (a
 * client screenshot is what caught it — not this project's own review).
 * The current path is Meta's official Threads mark via Simple Icons
 * (github.com/simple-icons/simple-icons, icons/threads.svg), re-rasterized
 * here and confirmed as the real "@" pretzel glyph before landing.
 */

type IconProps = { className?: string };

export function FacebookGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M15.6 8.9h-1.5c-.8 0-1 .4-1 1.1v1.5h2.5l-.3 2.5h-2.2V21h-2.6v-6.9H8.4v-2.5h2.1V9.7c0-2.1 1.2-3.5 3.4-3.5h1.7v2.7z"
        fill="currentColor"
      />
    </svg>
  );
}

export function XGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M4 4l6.9 8.8L4.2 20h1.9l5.8-6.3L16.5 20H20l-7.2-9.2L19.2 4h-1.9l-5.4 5.8L8 4H4z" fill="currentColor" />
    </svg>
  );
}

export function ThreadsGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WhatsAppGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.79 14.11c-.24.68-1.19 1.24-1.95 1.4-.52.11-1.2.2-3.48-.75-2.92-1.21-4.8-4.17-4.95-4.36-.14-.19-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.15.11.32.02.51-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.13-.28.28-.12.55.16.27.71 1.17 1.52 1.9 1.05.94 1.93 1.23 2.2 1.37.27.14.43.12.59-.07.16-.19.68-.79.86-1.06.18-.27.36-.22.61-.13.25.09 1.58.75 1.85.88.27.13.45.2.51.31.07.11.07.63-.17 1.31z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Generic "share" mark (three linked nodes) — the fallback share action, not tied to any one platform. */
export function ShareGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L7.04 9.81C6.5 9.31 5.79 9 5 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"
        fill="currentColor"
      />
    </svg>
  );
}
