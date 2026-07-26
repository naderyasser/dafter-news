import Image from "next/image";

/**
 * Stands in for the design's <image-slot> placeholder: a soft gray box
 * with centered label when there's no image yet, a real <Image> once one
 * is uploaded through the dashboard.
 */
export default function CoverImage({
  src,
  alt,
  placeholder,
  className = "",
  sizes = "(min-width: 768px) 33vw, 100vw",
}: {
  src?: string | null;
  alt: string;
  placeholder: string;
  className?: string;
  sizes?: string;
}) {
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-surface-2 text-center text-caption font-semibold text-header-muted ${className}`}>
        {placeholder}
      </div>
    );
  }
  // `fill` needs a positioned ancestor, so this wrapper supplies `relative` —
  // but every caller passes `absolute inset-0`, and Tailwind emits `.relative`
  // *after* `.absolute`, so the hardcoded class won the cascade. The wrapper
  // then laid out as a relative box whose only child is out of flow: zero
  // height, image painted into nothing. (The placeholder branch above sets no
  // position, which is why empty slots always rendered and only real covers
  // went blank.) Skip `relative` when the caller already positions us — an
  // absolute box is itself a containing block, so `fill` still resolves.
  const positioned = /(?:^|\s)(?:absolute|fixed|sticky|relative)(?:\s|$)/.test(className);

  return (
    <div className={`${positioned ? "" : "relative"} overflow-hidden bg-surface-2 ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
