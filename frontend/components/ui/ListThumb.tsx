import CoverImage from "@/components/ui/CoverImage";

/**
 * The one thumbnail frame every list row on the site uses.
 *
 * Before this, rows carried ten different frames — 120px 4:3 beside the
 * hero, 104×72 under «شؤون مصر», 68×52 in «الأكثر قراءة», 54×54 on the
 * court register, 84×62 in the article-page rail — so a reader scrolling a
 * feed saw some stories with a wide banner-ish thumbnail and others with a
 * small square one, and read the difference as a hierarchy that was never
 * intended. The client's note: make them all the same.
 *
 * Square, `object-cover`, `rounded-md`, and always on the row's inline END
 * (the left edge in Arabic) so the headline leads. Two sizes only: `md` for
 * the main feeds, `sm` for sidebars and secondary rails. Anything wider than
 * this is a lead photo, which is a different thing and keeps its own shape.
 *
 * `sizes` is pinned to the frame's own width so the optimiser serves a
 * thumbnail-sized file, not the 470KB cover behind it.
 */
export type ListThumbProps = {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md";
  /** Extra classes on the frame — a `grayscale`, a responsive `hidden sm:block`. */
  className?: string;
  /** The empty slot's text, when there is neither a source nor a fallback. */
  placeholder?: string;
  fallbackSrc?: string;
  fallbackFit?: "cover" | "contain";
  fit?: "cover" | "contain";
  position?: "center" | "top";
  /** Badges and chips laid over the photo — absolutely positioned by the caller. */
  children?: React.ReactNode;
};

const SIZE = {
  sm: { frame: "w-[64px]", sizes: "64px" },
  md: { frame: "w-[88px] sm:w-[96px]", sizes: "96px" },
} as const;

export default function ListThumb({
  src,
  alt = "",
  size = "md",
  className = "",
  placeholder = "",
  fallbackSrc,
  fallbackFit,
  fit,
  position,
  children,
}: ListThumbProps) {
  const s = SIZE[size];
  return (
    <div className={`relative aspect-square ${s.frame} flex-shrink-0 overflow-hidden rounded-md bg-surface-2 ${className}`}>
      <CoverImage
        src={src}
        alt={alt}
        placeholder={placeholder}
        className="absolute inset-0"
        sizes={s.sizes}
        fallbackSrc={fallbackSrc}
        fallbackFit={fallbackFit}
        fit={fit}
        position={position}
      />
      {children}
    </div>
  );
}
