"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Stands in for the design's <image-slot> placeholder: a soft gray box
 * with centered label when there's no image yet, a real <Image> once one
 * is uploaded through the dashboard.
 *
 * Fades in on load rather than popping straight in — a card grid where every
 * photo appears at once, at whatever moment each happens to finish
 * downloading, reads as flicker rather than a page settling in.
 */
export default function CoverImage({
  src,
  alt,
  placeholder,
  className = "",
  placeholderClassName,
  sizes = "(min-width: 768px) 33vw, 100vw",
}: {
  src?: string | null;
  alt: string;
  placeholder: string;
  className?: string;
  /**
   * Replaces the empty slot's own colours. The default is a light grey box,
   * which is right on paper and a bright hole punched through the dark fronts
   * («لقطة وتعليق», «علوم وتكنولوجيا») — there it reads as a broken image
   * rather than as a slot waiting for one.
   */
  placeholderClassName?: string;
  sizes?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    const tone = placeholderClassName ?? "bg-surface-2 text-header-muted";
    return (
      <div className={`flex items-center justify-center text-center text-caption font-semibold ${tone} ${className}`}>
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
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
