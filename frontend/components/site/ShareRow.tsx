"use client";

import { useState } from "react";

import { FacebookGlyph, ShareGlyph, ThreadsGlyph, WhatsAppGlyph, XGlyph } from "@/components/ui/BrandIcons";

type Network = "facebook" | "x" | "threads" | "whatsapp" | "copy";

const PLATFORMS: { key: Network; label: { ar: string; en: string }; Icon: typeof FacebookGlyph; bg: string }[] = [
  { key: "facebook", label: { ar: "فيسبوك", en: "Facebook" }, Icon: FacebookGlyph, bg: "bg-[#1877F2]" },
  { key: "x", label: { ar: "منصة X", en: "X" }, Icon: XGlyph, bg: "bg-ink" },
  { key: "threads", label: { ar: "ثريدز", en: "Threads" }, Icon: ThreadsGlyph, bg: "bg-ink" },
  { key: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" }, Icon: WhatsAppGlyph, bg: "bg-[#25D366]" },
];

/**
 * Copy a URL to the clipboard, with a fallback for the case that actually
 * bites in production: `navigator.clipboard` is only defined in a SECURE
 * context. On a plain http:// origin — a staging box, a LAN preview, an
 * intranet deployment — it is `undefined`, so the old
 * `navigator.clipboard?.writeText(...)` optional-chained into a silent
 * no-op. The reader clicked the share button and nothing happened, which
 * is exactly the "زر المشاركة العام لا يعمل" report.
 *
 * The `execCommand("copy")` path is deprecated but still implemented
 * everywhere and works over plain http, so it is the honest fallback
 * rather than a second silent failure.
 */
async function copyToClipboard(url: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      // Permission denied or a non-focused document — fall through.
    }
  }
  try {
    const field = document.createElement("textarea");
    field.value = url;
    // Off-screen rather than `display:none` — a hidden field can't be
    // selected, and an unselected field copies nothing.
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-9999px";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

export default function ShareRow({ lang, title }: { lang: "ar" | "en"; title: string }) {
  const isAr = lang === "ar";
  // "copied" / "failed" drive the confirmation chip. Without it the copy
  // action gave no feedback at all, so even a *successful* copy looked
  // like a dead button.
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const btnClass =
    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-paper transition-opacity duration-fast hover:opacity-85";

  const share = async (network: Network) => {
    if (typeof window === "undefined") return;
    const url = window.location.href;

    if (network === "copy") {
      // The native share sheet is what a phone reader actually expects
      // from a generic share button — it offers every app they have
      // installed, not just the four we hardcode. Desktop browsers
      // mostly don't implement it, so clipboard remains the fallback.
      if (navigator.share) {
        try {
          await navigator.share({ title, url });
          return;
        } catch (err) {
          // A user dismissing the sheet throws AbortError — that's a
          // deliberate cancel, not a failure to report or fall back from.
          if ((err as Error)?.name === "AbortError") return;
        }
      }
      const ok = await copyToClipboard(url);
      setCopyState(ok ? "copied" : "failed");
      window.setTimeout(() => setCopyState("idle"), 2000);
      return;
    }

    const shareUrl = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      x: `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      // Threads' documented intent takes one `text` param — url and title
      // both go in it, there is no separate `url` field like X's.
      threads: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${title} ${url}`)}`,
      // No phone number — this opens WhatsApp letting the reader pick who
      // to send it to, unlike the footer's fixed-number "advertise" link.
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    }[network];
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const copyLabel = isAr ? "نسخ الرابط" : "Copy link";

  return (
    <span className="ms-auto flex items-center gap-2">
      {PLATFORMS.map(({ key, label, Icon, bg }) => (
        // A real <button>, not a <span onClick>: the old markup was
        // unreachable by keyboard and invisible to assistive tech, which
        // made the row look decorative rather than interactive.
        <button
          key={key}
          type="button"
          className={`${btnClass} ${bg}`}
          title={label[lang]}
          aria-label={label[lang]}
          onClick={() => share(key)}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      <button
        type="button"
        className={`${btnClass} ${copyState === "copied" ? "bg-up" : copyState === "failed" ? "bg-down" : "bg-ink-2"}`}
        title={copyLabel}
        aria-label={copyLabel}
        onClick={() => share("copy")}
      >
        <ShareGlyph className="h-4 w-4" />
      </button>
      {/* Announced to screen readers as well as shown, so the outcome of a
          copy is never colour-only. */}
      {copyState !== "idle" && (
        <span
          role="status"
          className={`text-[12px] font-bold ${copyState === "copied" ? "text-up" : "text-down"}`}
        >
          {copyState === "copied"
            ? isAr
              ? "تم نسخ الرابط"
              : "Link copied"
            : isAr
              ? "تعذّر النسخ"
              : "Copy failed"}
        </span>
      )}
    </span>
  );
}
