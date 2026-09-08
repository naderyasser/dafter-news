"use client";

import { useState } from "react";

import { REEL_COPY, YoutubeGlyph } from "@/components/site/ReelPoster";
import { YOUTUBE_IFRAME_ALLOW, youtubeEmbedSrc } from "@/lib/youtube";

/**
 * The reel's own page: YouTube's player, life-sized, plus a small action row
 * underneath — a real Share (the Web Share API where the browser offers one,
 * copy-the-link where it doesn't, both sharing THIS page's URL so the reader
 * lands back here rather than on YouTube), and a plain link to the video on
 * YouTube itself, where liking and commenting actually live.
 */
export default function ReelPlayer({
  lang,
  title,
  youtubeId,
  shareUrl,
  watchUrl,
}: {
  lang: "ar" | "en";
  title: string;
  youtubeId: string;
  /** This reel's own page on the site — what Share hands out. */
  shareUrl: string;
  /** The video on YouTube — the newsroom's own pasted link. */
  watchUrl: string;
}) {
  const t = lang === "ar" ? REEL_COPY.ar : REEL_COPY.en;
  const [justCopied, setJustCopied] = useState(false);

  const share = async () => {
    // Typed as optional in TS's own DOM lib (not every browser offers it),
    // which is exactly the branch this checks for at runtime too.
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // The reader cancelled the native share sheet, or the browser
        // refused it — either way there is nothing useful to do about it.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // No share sheet and no clipboard access — the YouTube link below
      // still gets a reader to the real thing either way.
    }
  };

  return (
    // One column: the frame, then the action row. The frame sizes ITSELF
    // from the viewport's height (see .reel-stage in globals.css) and centres
    // inside this column; the column's own cap is what the action row under
    // it follows, so the two buttons stay wide enough to read on a phone.
    <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4 px-4">
      <div className="reel-stage relative mx-auto overflow-hidden rounded-2xl bg-board-stage shadow-2xl">
        <iframe
          src={youtubeEmbedSrc(youtubeId, { autoplay: true })}
          title={title}
          allow={YOUTUBE_IFRAME_ALLOW}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          // Taken out of flow rather than left as the inline element an
          // <iframe> is by default: an inline box sits on a text baseline,
          // and the few pixels of line-height under it overflow an
          // aspect-ratio'd parent as a sliver of background under the video.
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>

      <div className="flex w-full items-center justify-center gap-3">
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-2 rounded-pill border border-white/15 bg-board-stage px-4 py-2.5 text-[13.5px] font-bold text-paper transition-colors hover:border-brand hover:text-brand"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" role="presentation">
            <path d="M18 16.08a2.9 2.9 0 0 0-1.94.75l-6.86-4a2.8 2.8 0 0 0 0-1.66l6.86-4a2.92 2.92 0 1 0-.9-2.1c0 .27.05.53.14.77l-6.87 4a2.92 2.92 0 1 0 0 4.32l6.87 4c-.09.24-.14.5-.14.77a2.92 2.92 0 1 0 2.9-2.85Z" />
          </svg>
          {justCopied ? t.shared : t.share}
        </button>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-brand px-4 py-2.5 text-[13.5px] font-bold text-paper no-underline transition-colors hover:bg-brand-strong"
        >
          <YoutubeGlyph className="h-4 w-4" />
          {t.onYoutube}
        </a>
      </div>
    </div>
  );
}
