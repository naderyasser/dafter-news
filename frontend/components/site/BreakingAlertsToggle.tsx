"use client";

import { useEffect, useState } from "react";

import { API_URL, apiMutate } from "@/lib/api";

/** base64url VAPID key → the Uint8Array the Push API insists on. */
function toKeyArray(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "off" | "on" | "blocked" | "working";

/**
 * Opt-in for «عاجل» push alerts.
 *
 * Renders nothing until we know the browser can do this and the server has
 * VAPID keys — a dead toggle is worse than no toggle. Permission is requested
 * on the click, never on load: an unprompted permission dialog is the fastest
 * way to get a site permanently blocked.
 */
export default function BreakingAlertsToggle() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/push/key/`);
        if (!res.ok) {
          setState("unsupported"); // server has no VAPID keys configured
          return;
        }
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  const enable = async () => {
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const { publicKey } = await fetch(`${API_URL}/push/key/`).then((r) => r.json());
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKeyArray(publicKey),
      });
      await apiMutate("/push/subscribe/", "POST", JSON.parse(JSON.stringify(sub)));
      setState("on");
    } catch {
      setState("off");
    }
  };

  const disable = async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await apiMutate("/push/unsubscribe/", "POST", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  };

  if (state === "checking" || state === "unsupported") return null;

  if (state === "blocked") {
    return (
      <span className="text-[13px] text-header-muted">
        التنبيهات محظورة من إعدادات المتصفح
      </span>
    );
  }

  const on = state === "on";
  return (
    <button
      type="button"
      onClick={on ? disable : enable}
      disabled={state === "working"}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-fast disabled:opacity-60 ${
        on
          ? "border-brand bg-brand text-paper"
          : "border-line-strong text-header-ink hover:border-brand hover:text-brand"
      }`}
    >
      <span aria-hidden>{on ? "🔔" : "🔕"}</span>
      {state === "working" ? "لحظة…" : on ? "تنبيهات العاجل مفعّلة" : "فعّل تنبيهات العاجل"}
    </button>
  );
}
