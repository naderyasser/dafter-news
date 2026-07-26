"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { WelcomeAlert } from "@/lib/types";

const STORAGE_KEY = "aldaftar:welcome-dismissed";

/**
 * The on-load «يحدث الآن» modal.
 *
 * Dismissal is remembered in sessionStorage keyed by the alert's title, so
 * closing it silences *that* alert for the visit but a newly published one
 * still gets through — a persistent key would mean the next breaking story
 * never shows.
 *
 * Mounting is deferred until after paint: rendering it during SSR would put
 * an overlay in the static HTML, which is what makes these modals show up in
 * search results and flash on a cached page.
 */
export default function WelcomeModal({ alert }: { alert: WelcomeAlert | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!alert?.active || !alert.title) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === alert.title) return;
    } catch {
      // Private mode with storage disabled — show the alert rather than
      // silently suppressing it.
    }
    const id = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(id);
  }, [alert]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = () => {
    setOpen(false);
    try {
      if (alert?.title) sessionStorage.setItem(STORAGE_KEY, alert.title);
    } catch {
      /* storage unavailable — dismissal just won't persist */
    }
  };

  if (!open || !alert) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div role="presentation" onClick={dismiss} className="animate-fade-in absolute inset-0 bg-[rgba(16,27,51,.7)]" />

      <div className="animate-modal-in relative w-full max-w-[520px] overflow-hidden rounded-card bg-paper shadow-2">
        <div className="flex items-center gap-2.5 bg-badge-breaking px-5 py-2.5">
          <span className="h-2 w-2 flex-shrink-0 animate-pulse-dot rounded-full bg-paper" />
          <span className="text-[13px] font-extrabold text-paper">{alert.kicker}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إغلاق"
            className="ms-auto flex h-7 w-7 items-center justify-center rounded text-[15px] text-paper/80 hover:text-paper"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3 p-6">
          <h2 id="welcome-title" className="font-display-ar text-[21px] font-extrabold leading-[1.45] text-ink">
            {alert.title}
          </h2>
          {alert.text ? <p className="text-[15px] leading-relaxed text-ink-2">{alert.text}</p> : null}

          <div className="mt-1 flex items-center gap-3">
            {alert.cta_label && alert.cta_href ? (
              <Link
                href={alert.cta_href}
                onClick={dismiss}
                className="rounded-pill bg-brand px-5 py-2.5 text-[14px] font-bold text-paper no-underline transition-colors duration-fast hover:bg-brand-strong"
              >
                {alert.cta_label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="text-[14px] font-semibold text-ink-3 transition-colors duration-fast hover:text-ink"
            >
              لاحقاً
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
