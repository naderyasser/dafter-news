"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CoverImage from "@/components/ui/CoverImage";
import type { UrgentNotification as UrgentNotificationData } from "@/lib/types";
import { mediaUrl } from "@/lib/api";

const STORAGE_KEY = "aldaftar:urgent-dismissed";

const T = {
  ar: { close: "إغلاق الإشعار" },
  en: { close: "Close notification" },
};

/**
 * The floating "urgent" popup — an editor ticks «إشعار عاجل» on an article
 * and it shows up here, on every page, for 24h or until a fresher urgent
 * article takes its place (see UrgentNotificationView; there is nothing to
 * "cancel", the older one just stops being the one the API returns).
 *
 * Deliberately the whole card, not a CTA inside it: the brief was explicit
 * that the box itself has to be clickable, not just a button inside it — so
 * this is one <Link> wrapping everything, with the close button opting
 * itself out of that click rather than sitting beside it.
 *
 * Sits at the *opposite* corner from WelcomeToast (`end` instead of `start`)
 * at the same bottom offset, clearing the sticky ticker — the two are
 * independent editorial surfaces and can legitimately both be active at
 * once; stacking them in the same corner would mean one covering the other.
 *
 * Dismissal is remembered in localStorage (not sessionStorage, unlike
 * WelcomeToast) keyed by the notification's id — the brief was explicit
 * that closing it should hold across visits, not just the tab session,
 * until a newer urgent article overrides it by carrying a different id.
 *
 * Mounted after paint, same reasoning as WelcomeToast: server-rendering a
 * transient popup would put it in the static HTML search engines index and
 * on a cached page a reader already dismissed.
 */
export default function UrgentNotification({
  notification,
  lang = "ar",
}: {
  notification: UrgentNotificationData | null;
  lang?: "ar" | "en";
}) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const t = T[lang];
  const id = notification?.id;

  useEffect(() => {
    if (!id) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === String(id)) return;
    } catch {
      // Private mode with storage disabled — show it rather than silently
      // suppressing it.
    }
    const timer = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(timer);
  }, [id]);

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
    setLeaving(true);
    window.setTimeout(() => {
      setOpen(false);
      setLeaving(false);
    }, 200);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* storage unavailable — dismissal just won't persist */
    }
  };

  if (!open || !notification?.id || !notification.href) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby="urgent-notification-title"
      className={`fixed bottom-[68px] end-5 z-[100] w-[min(360px,calc(100vw-2.5rem))] ${
        leaving ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <Link
        href={notification.href}
        onClick={dismiss}
        className="card-link relative flex items-center gap-3 overflow-hidden rounded-card border border-line bg-paper p-3 pe-9 no-underline shadow-2"
        // Literal hex, not `var(--brand)` — the brand colour only exists as a
        // Tailwind theme token compiled at build time, there is no runtime
        // CSS custom property by that name to reference.
        style={{ "--card-accent": "#B01F2E" } as React.CSSProperties}
      >
        {notification.cover_image && (
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-[6px]">
            <CoverImage src={mediaUrl(notification.cover_image)} alt="" placeholder="" className="absolute inset-0" sizes="56px" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-brand">
            <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
            {notification.label}
          </span>
          <h2
            id="urgent-notification-title"
            className={`${lang === "ar" ? "font-display-ar" : "font-display-en"} card-title m-0 mt-1 line-clamp-2 text-[14px] font-extrabold leading-[1.5] text-ink`}
          >
            {notification.title}
          </h2>
        </div>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.close}
        className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded text-[14px] text-ink-3 hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
