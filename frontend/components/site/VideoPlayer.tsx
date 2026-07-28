"use client";

import { useState } from "react";

/**
 * The video page used to render a poster with a decorative ▶ that played
 * nothing — there was no source to play. Now that a video carries either an
 * uploaded file or an external link, this actually starts it.
 *
 * Click-to-load rather than autoplay or an always-mounted iframe: an embed
 * mounted on render pulls a third-party player (and its cookies) onto the page
 * for every reader who scrolls past, before anyone has asked to watch.
 */
function embedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null;
    }
    // Anything else: only embed it if it's a direct media file. An arbitrary
    // page in an iframe is as likely to be a redirect or a paywall as a video.
    if (/\.(mp4|webm|ogg|m3u8)$/i.test(url.pathname)) return raw;
    return null;
  } catch {
    return null;
  }
}

const T = {
  ar: { play: "تشغيل", unavailable: "الفيديو غير متاح حالياً", exclusive: "حصري" },
  en: { play: "Play", unavailable: "This video is currently unavailable", exclusive: "Exclusive" },
};

export default function VideoPlayer({
  lang = "ar",
  src,
  externalUrl,
  poster,
  title,
  isExclusive,
  durationLabel,
}: {
  lang?: "ar" | "en";
  src?: string;
  externalUrl?: string;
  poster?: string;
  title: string;
  isExclusive?: boolean;
  durationLabel?: string;
}) {
  const t = T[lang];
  const [playing, setPlaying] = useState(false);
  const embed = externalUrl ? embedUrl(externalUrl) : null;
  // An uploaded file wins over a link: it's served from our own origin, so it
  // needs no third party and no embed rules.
  const playable = Boolean(src) || Boolean(embed);

  if (playing && src) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-card bg-header-bg">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={src} poster={poster} controls autoPlay className="h-full w-full" />
      </div>
    );
  }

  if (playing && embed) {
    const direct = /\.(mp4|webm|ogg)$/i.test(embed);
    return (
      <div className="relative aspect-video overflow-hidden rounded-card bg-header-bg">
        {direct ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={embed} poster={poster} controls autoPlay className="h-full w-full" />
        ) : (
          <iframe
            src={embed}
            title={title}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-card bg-header-bg">
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt={title} className="h-full w-full object-cover" />
      ) : null}

      {playable ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`${t.play}: ${title}`}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[rgba(23,26,31,.55)] text-[26px] text-paper transition-colors duration-fast hover:bg-brand">
            <span className="inline-block -scale-x-100">▶</span>
          </span>
        </button>
      ) : (
        // No source at all — keep the poster, but don't offer a control that
        // would do nothing.
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <span className="rounded-badge bg-[rgba(23,26,31,.7)] px-3 py-1.5 text-xs font-semibold text-paper">
            {t.unavailable}
          </span>
        </div>
      )}

      {isExclusive && (
        <span className="absolute start-3 top-3 rounded-badge bg-badge-breaking px-2.5 py-1 text-xs font-bold text-paper">{t.exclusive}</span>
      )}
      {durationLabel && durationLabel !== "—" && (
        <span className="tnum absolute bottom-3 start-3 rounded-badge bg-[rgba(23,26,31,.75)] px-2 py-1 text-xs text-paper">
          {durationLabel}
        </span>
      )}
    </div>
  );
}
