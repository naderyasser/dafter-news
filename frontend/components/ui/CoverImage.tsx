"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

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
  fit = "cover",
  position = "center",
  fallbackSrc,
  fallbackFit = "contain",
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
  /**
   * `cover` (the default) fills the frame — right for a real news photo or
   * an author's avatar standing in for one. `contain` is for a fallback
   * that is a MARK rather than a photo (the site's own logo, used when an
   * article has neither a cover nor an eligible avatar to fall back to) —
   * `cover` would blow it up and crop it like a photograph it isn't.
   */
  fit?: "cover" | "contain";
  /**
   * Where `cover` anchors the crop. `top` is for the author-avatar
   * fallback specifically — a portrait's face sits in the upper part of the
   * frame, and `center` on a wide card crops straight through it.
   */
  position?: "center" | "top";
  /**
   * An IMAGE to stand in when `src` is missing or fails to load — the
   * site's own mark, or a columnist's portrait (see lib/coverFallback).
   * Without it the slot shows the text `placeholder` on grey, which in a
   * thumbnail-sized slot reads as a broken image. If the fallback itself
   * fails, the text placeholder is the last resort.
   */
  fallbackSrc?: string;
  fallbackFit?: "cover" | "contain";
}) {
  const [loaded, setLoaded] = useState(false);
  const [fallbackErrored, setFallbackErrored] = useState(false);
  // A src that 404s (or decodes as garbage) never fires onLoad, so the image
  // stayed at opacity-0 over the wrapper's grey — an empty box that looked
  // identical to a broken layout and never resolved. Falling back to the same
  // slot the no-src branch already renders means a dead URL degrades to the
  // branded placeholder instead of a hole in the grid.
  const [errored, setErrored] = useState(false);

  /**
   * The fade-in is gated on `onLoad`, and `onLoad` can be missed entirely: an
   * image already in the browser cache can finish decoding before React
   * attaches the handler, and the event has then already fired. The image
   * would sit at `opacity-0` forever — no error, so the `errored` fallback
   * above never catches it, and a returning reader sees a grey box where a
   * first-time visitor sees the photograph.
   *
   * The ref callback closes that window: `complete` is true the moment the
   * element exists if the bytes were already there, so the fade is settled
   * before the first paint rather than waiting on an event that will not come.
   */
  const settleIfCached = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete) setLoaded(true);
  }, []);

  const useFallback = (!src || errored) && !!fallbackSrc && !fallbackErrored;
  if ((!src || errored) && !useFallback) {
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

  const shownSrc = useFallback ? (fallbackSrc as string) : (src as string);
  const shownFit = useFallback ? fallbackFit : fit;
  return (
    <div className={`${positioned ? "" : "relative"} overflow-hidden bg-surface-2 ${className}`}>
      <Image
        key={shownSrc}
        ref={settleIfCached}
        src={shownSrc}
        alt={alt}
        fill
        sizes={sizes}
        // Literal class names, not interpolated — Tailwind's JIT scanner
        // only generates a class it can see written out somewhere in source.
        className={`${shownFit === "contain" ? "object-contain" : "object-cover"} ${position === "top" ? "object-top" : "object-center"} transition-opacity duration-500 ease-out motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => (useFallback ? setFallbackErrored(true) : setErrored(true))}
      />
    </div>
  );
}
