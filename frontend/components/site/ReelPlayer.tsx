"use client";

import { useEffect, useState } from "react";

import { facebookEmbedSrc } from "@/lib/facebookEmbed";

const T = {
  ar: {
    // Two lines, on purpose — the badge is a compact box now, not a bar
    // spanning the player's width, so the copy is split rather than clamped.
    mutedLines: ["اضغط على أيقونة الصوت", "لسماع صوت الفيديو"],
    dismissHint: "إخفاء هذا التنبيه",
    share: "مشاركة",
    shared: "تم نسخ الرابط",
    engage: "تفاعل على فيسبوك",
    openOnFacebook: "فتح على فيسبوك",
  },
  en: {
    mutedLines: ["Tap the sound icon", "to hear the video"],
    dismissHint: "Dismiss this hint",
    share: "Share",
    shared: "Link copied",
    engage: "Engage on Facebook",
    openOnFacebook: "Open on Facebook",
  },
};

/**
 * The reel's own page — Facebook's public Video Plugin, life-sized, plus a
 * small honest action row underneath.
 *
 * "Honest" is the operative word for that row. There is no Like/reaction
 * COUNT here, on purpose: that would mean either faking a plausible-looking
 * number with nothing real behind it, or calling the Meta Graph API for the
 * real one — which this project's own brief explicitly ruled out earlier
 * (see PHASE 2 of the original reels spec: "canceling the automated Meta
 * Graph API fetching"). What IS honest and fully functional without that
 * API: a real Share action (the Web Share API where the browser offers one,
 * a copy-the-link fallback where it doesn't — both share the reel's actual
 * Facebook URL, not a fabricated permalink), and a plain, clearly-labelled
 * link to react, comment or share on Facebook itself, where those actions
 * actually live.
 */
export default function ReelPlayer({
  lang,
  title,
  facebookUrl,
}: {
  lang: "ar" | "en";
  title: string;
  facebookUrl: string;
}) {
  const isAr = lang === "ar";
  const t = isAr ? T.ar : T.en;
  const [hintDismissed, setHintDismissed] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Auto-dismisses on its own after five seconds — long enough to read a
  // short line, short enough not to sit over the one thing worth watching
  // for the length of the clip. The close button beside it stays for a
  // reader who wants it gone sooner; this timer never overrides that, it
  // only sets an upper bound for a reader who does nothing at all.
  useEffect(() => {
    const timer = setTimeout(() => setHintDismissed(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const share = async () => {
    // Typed as optional in TS's own DOM lib (not every browser offers it),
    // which is exactly the branch this checks for at runtime too.
    if (navigator.share) {
      try {
        await navigator.share({ title, url: facebookUrl });
      } catch {
        // The reader cancelled the native share sheet, or the browser
        // refused it — either way there is nothing useful to do about it.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(facebookUrl);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // No share sheet and no clipboard access — the "فتح على فيسبوك" link
      // below still gets a reader to the real thing either way.
    }
  };

  return (
    // One column, one gap: the frame, the action row, the escape-hatch link.
    // The frame sizes ITSELF from the viewport's height (see .reel-stage in
    // globals.css) and centres inside this column; the column's own 380px cap
    // is what the action row under it follows, so the two buttons stay wide
    // enough to read their labels on a narrow phone even when the video above
    // them is narrower still. `px-4` keeps the column clear of the screen edge
    // on top of the page's own padding.
    <div className="mx-auto flex w-full max-w-[380px] flex-col items-center gap-4 px-4">
      <div className="reel-stage relative mx-auto overflow-hidden rounded-2xl bg-board-stage shadow-2xl">
        {/*
          Meta's own documented behaviour, not a gap in this build:
          developers.facebook.com/docs/plugins/embedded-video-player states
          plainly that autoplay "will be played without sound (muted)", with
          no parameter that overrides it. No browser would honour one anyway
          — unmuted autoplay is blocked platform-wide unless the reader has
          already interacted with THIS SPECIFIC origin, which a freshly-
          mounted cross-origin iframe never has. Every major platform
          embedding short video (Instagram, X, TikTok) hits the identical
          wall and answers it the identical way: point at the sound switch
          rather than pretend one isn't needed.

          A compact box in the player's own top corner, not a bar along its
          bottom edge — small enough to read as a passing tip rather than a
          strip of chrome permanently claiming part of the frame.

          Always mounted, never conditionally removed: a CSS opacity
          transition needs the element to still be there to animate, so
          dismissal (the timer below, or a reader's own tap) toggles classes
          rather than pulling it out of the tree. `pointer-events-none` once
          faded stops an invisible box from still catching a tap meant for
          the video underneath it, and `aria-hidden` + `tabIndex={-1}` pull
          it out of the accessibility tree and the Tab order the same
          moment — opacity alone hides something from sighted readers, not
          from a screen reader or a keyboard, which would otherwise still
          land on and announce a button nobody can see any more.

          Dismissible, and self-dismissing after five seconds either way: it
          has done its job the moment a reader has read it once, and left up
          over a vertical video it starts covering the one thing worth
          watching. The whole box is the dismiss target — a compact badge
          like this has no room for a separate, smaller-still tap target
          without making both worse — with a small ✕ in its own corner
          purely as the visual hint that it's dismissible.
        */}
        <button
          type="button"
          onClick={() => setHintDismissed(true)}
          aria-label={t.dismissHint}
          aria-hidden={hintDismissed}
          tabIndex={hintDismissed ? -1 : 0}
          className={`absolute end-6 top-6 z-40 flex w-[104px] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-board-stage/80 p-3 text-center shadow-lg backdrop-blur-md transition-opacity duration-300 ${
            hintDismissed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <span
            aria-hidden
            className="absolute end-1 top-1 flex h-4 w-4 items-center justify-center text-[10px] leading-none text-header-muted"
          >
            ✕
          </span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-5 w-5 flex-shrink-0 fill-none stroke-current text-paper"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53L6.75 15H4.5A2.25 2.25 0 0 1 2.25 12.75v-1.5A2.25 2.25 0 0 1 4.5 9h2.25Z" />
          </svg>
          <span className="text-xs font-medium leading-relaxed text-paper/90">
            <span>{t.mutedLines[0]}</span>
            <br />
            <span>{t.mutedLines[1]}</span>
          </span>
        </button>

        <iframe
          src={facebookEmbedSrc(facebookUrl, { width: 448, height: 796 })}
          title={title}
          // Facebook's own documented permission set for this plugin —
          // `clipboard-write` and `web-share` specifically are what its
          // native Share control needs.
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          allowFullScreen
          // Taken out of flow rather than left as the inline element an
          // <iframe> is by default: an inline box sits on a text baseline, and
          // the few pixels of line-height under it overflow an
          // aspect-ratio'd parent, which is a sliver of the frame's own
          // background showing under the video on some screens.
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>

      {/*
        The action row. Two REAL actions, nothing decorative: a working
        Share (this page's own reel, shared as its actual Facebook link —
        see the component docstring for why there is no fabricated Like
        count sitting beside it), and a plain link to where reacting,
        commenting and sharing on Facebook itself actually happen.
      */}
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
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-brand px-4 py-2.5 text-[13.5px] font-bold text-paper no-underline transition-colors hover:bg-brand-strong"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" role="presentation">
            <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.54-1.5H16.7V3.63A21 21 0 0 0 14.3 3.5c-2.37 0-4 1.45-4 4.11V9.9H7.6V13h2.7v8Z" />
          </svg>
          {t.engage}
        </a>
      </div>

      {/*
        A cross-origin iframe that Facebook itself renders an in-frame error
        into (a video its Page owner blocked from embedding, a since-deleted
        reel) still answers our request with a plain HTTP 200 — there is no
        onError, no signal at all, that reaches this page when that happens.
        This second, plainer link is the fallback for exactly that: a way
        back to the real thing that doesn't depend on the embed having
        worked, sitting apart from the styled action row above so it reads
        as the escape hatch it is rather than a third equal action.
      */}
      <div className="-mt-1 w-full text-center">
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-header-muted underline decoration-white/30 underline-offset-2 hover:text-paper"
        >
          {t.openOnFacebook} ↗
        </a>
      </div>
    </div>
  );
}
