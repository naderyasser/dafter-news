"use client";

import Link from "next/link";
import { isArabicScript } from "@/lib/format";
import { useEffect, useState } from "react";

import type { WelcomeAlert } from "@/lib/types";

const STORAGE_KEY = "aldaftar:welcome-dismissed";

const T = {
  ar: { later: "لاحقاً", close: "إغلاق" },
  en: { later: "Later", close: "Close" },
};

/** True when the string is written in Arabic script. */

/**
 * The site's greeting/announcement box, as a corner toast. The copy is
 * editorial (dashboard → WelcomeAlert), so the same box can welcome readers
 * today and point at live coverage tomorrow without a deploy.
 *
 * It used to be a centred modal over a dimmed page. That is an interruption:
 * it stops a reader who came for something else, and it has to be dismissed
 * before the site can be used at all. The client asked for it out of the way
 * — so this is non-blocking by construction. No backdrop, no scroll lock, no
 * aria-modal, and no focus trap: the page stays fully usable behind it and it
 * announces itself politely instead of seizing the screen.
 *
 * Position is `start`, not `right`. On the Arabic edition that resolves to
 * the bottom-right corner the client pointed at, and on the English one it
 * mirrors to bottom-left — which is the same corner relative to the reading
 * direction rather than the same corner on the glass.
 *
 * The bottom offset clears the sticky markets ticker (52px, the same reserve
 * SiteFooter's pb-[52px] makes); without it the toast sits on top of the tape.
 *
 * Dismissal is remembered in sessionStorage keyed by the alert's title, so
 * closing it silences *that* alert for the visit but a newly published one
 * still gets through — a persistent key would mean the next breaking story
 * never shows.
 *
 * Mounting is deferred until after paint: rendering it during SSR would put
 * the alert in the static HTML, which is what makes these show up in search
 * results and flash on a cached page.
 */
export default function WelcomeToast({ alert, lang = "ar" }: { alert: WelcomeAlert | null; lang?: "ar" | "en" }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const t = T[lang];

  // The alert copy is a single column and (today) Arabic; showing it on the
  // English edition would break the page's language the same way the Arabic
  // stories rail did. Same rule as everywhere else: content renders only on
  // the edition whose script it is written in.
  const wrongEdition = alert?.title ? isArabicScript(alert.title) !== (lang === "ar") : false;

  useEffect(() => {
    if (!alert?.active || !alert.title || wrongEdition) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === alert.title) return;
    } catch {
      // Private mode with storage disabled — show the alert rather than
      // silently suppressing it.
    }
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(id);
    // wrongEdition derives from `lang` as well as `alert`, so leaving it out
    // meant a locale change alone could not re-evaluate the guard. Dormant
    // today (ar/en are separate routes, so `lang` never changes under a
    // mounted toast) — listed so it stays correct if that ever stops holding.
  }, [alert, wrongEdition]);

  // Escape still closes it. It does not trap focus, so this is a convenience
  // for whoever is already looking at it, not a way out of a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    // Animate out first; the toast is not in anyone's way, so it can afford
    // to leave as smoothly as it arrived.
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 200);
    try {
      if (alert?.title) sessionStorage.setItem(STORAGE_KEY, alert.title);
    } catch {
      /* storage unavailable — dismissal just won't persist */
    }
  };

  if (!open || !alert) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby="welcome-title"
      className={`fixed bottom-[68px] start-5 z-[100] w-[min(380px,calc(100vw-2.5rem))] ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      {/* rule-accent puts the red/blue identity bar down the leading edge —
          the client's «إدخال اللون الأزرق بجانب الأحمر» on this box. */}
      <div className="rule-accent overflow-hidden rounded-card border border-line bg-paper shadow-2">
        <div className="flex items-center gap-2.5 bg-accent-strong px-4 py-2.5">
          {/* Static, not pulsing: a pulse promises «live», and this box is a
              greeting unless editorial points it at actual coverage. */}
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand" aria-hidden />
          <span className="text-[12.5px] font-extrabold text-paper">{alert.kicker}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.close}
            className="ms-auto flex h-6 w-6 items-center justify-center rounded text-[14px] text-paper/75 hover:text-paper"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h2
            id="welcome-title"
            className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} m-0 text-[16px] font-extrabold leading-[1.5] text-accent`}
          >
            {alert.title}
          </h2>
          {alert.text ? <p className="m-0 text-[13.5px] leading-relaxed text-ink-2">{alert.text}</p> : null}

          <div className="mt-1 flex items-center gap-3">
            {alert.cta_label && alert.cta_href ? (
              // The CTA keeps the brand red: it is the one urgent thing in the
              // box, and the blue around it is what makes the red read as
              // urgent rather than as decoration.
              <Link
                href={alert.cta_href}
                onClick={dismiss}
                className="rounded-pill bg-brand px-4 py-2 text-[13px] font-bold text-paper no-underline transition-colors duration-fast hover:bg-brand-strong"
              >
                {alert.cta_label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="text-[13px] font-semibold text-ink-3 transition-colors duration-fast hover:text-ink"
            >
              {t.later}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
