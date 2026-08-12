/**
 * Single-colour brand glyphs — `fill="currentColor"`, no background baked
 * in, so a caller supplies its own colour via `className` (text-*) and
 * whatever container shape/background it wants (a circle, a square...).
 *
 * Each path was rasterized and checked by eye before use — a hand-typed
 * path is easy to get subtly wrong (see the Threads icon's first draft in
 * the footer, which rendered as the letter "e").
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
        d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.594 12c.022 3.086.713 5.496 2.05 7.164 1.43 1.783 3.63 2.697 6.54 2.717 2.623-.02 4.358-.63 5.8-2.04 1.64-1.605 1.611-3.594 1.088-4.798-.31-.71-.873-1.3-1.629-1.74-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.75-2.964-.065-1.19.36-2.335 1.187-3.202.796-.834 1.945-1.325 3.317-1.416.87-.06 1.7.008 2.472.203-.107-1.045-.463-1.867-1.06-2.451-.573-.56-1.396-.844-2.446-.844-.048 0-.096 0-.144.002-1.284.037-2.184.42-2.837 1.204l-1.65-1.294c.951-1.14 2.36-1.797 4.19-1.845.048-.002.096-.002.144-.002 1.616 0 2.926.489 3.9 1.454.933.925 1.475 2.211 1.61 3.822.058.014.116.03.174.045 1.484.394 2.66 1.135 3.395 2.14.977 1.34 1.132 3.34.394 5.062-.848 1.97-2.545 3.226-5.045 3.734l-.004.001z"
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
