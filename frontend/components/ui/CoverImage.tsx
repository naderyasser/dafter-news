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
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
    </div>
  );
}
