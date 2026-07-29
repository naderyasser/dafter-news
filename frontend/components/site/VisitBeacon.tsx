"use client";

import { useEffect } from "react";

import { API_URL } from "@/lib/api";

const SESSION_KEY = "aldaftar:visit-counted";

/**
 * Counts this browser session into «زيارات اليوم» — the writer the overview's
 * headline number never had (its only source was the demo seed).
 *
 * Once per session, not per page: sessionStorage survives navigation and
 * dies with the tab, which is as close to "a visit" as the client side can
 * honestly measure without cookies or fingerprinting. Fire-and-forget with
 * every failure swallowed — a reader must never pay for analytics, and
 * sendBeacon (with keepalive fetch as the fallback) survives the reader
 * navigating away mid-request.
 *
 * Renders nothing. Mounted once in SiteShell so every public page counts and
 * the dashboard, which mounts its own shell, never does.
 */
export default function VisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode with storage blocked: still count the view — worst
      // case a paranoid browser counts once per page instead of per session.
    }
    const url = `${API_URL}/visits/track/`;
    try {
      if (!navigator.sendBeacon || !navigator.sendBeacon(url)) {
        fetch(url, { method: "POST", keepalive: true }).catch(() => {});
      }
    } catch {
      /* never the reader's problem */
    }
  }, []);

  return null;
}
