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
  // A link a reader can select and copy by hand, shown only when every
  // programmatic path failed. In-app browsers (a link opened from inside
  // WhatsApp/Instagram/Facebook/Telegram, rather than a real browser tab)
  // routinely block both the Web Share API and the Clipboard API with no
  // error at all — the promise just never resolves the way a normal
  // browser's does, or execCommand silently returns false. Plain selectable
  // text in the page is the one fallback nothing can block, because it
  // isn't calling a privileged API at all.
  const [manualUrl, setManualUrl] = useState<string | null>(null);
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
      if (!ok) setManualUrl(url);
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
    <span className="relative ms-auto flex items-center gap-2">
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
          copy is never colour-only. Its own line (`w-full`), not squeezed
          into the same non-wrapping row as the five icon buttons — that row
          already sits flush against the edge of a narrow phone screen, and
          appending text after the last icon there could run past the
          viewport instead of onto a visible line. */}
      {copyState !== "idle" && (
        <span
          role="status"
          className={`absolute top-full mt-1.5 w-max max-w-[240px] text-[12px] font-bold ${
            isAr ? "end-0" : "start-0"
          } ${copyState === "copied" ? "text-up" : "text-down"}`}
        >
          {copyState === "copied"
            ? isAr
              ? "تم نسخ الرابط"
              : "Link copied"
            : isAr
              ? "تعذّر النسخ — انسخ الرابط يدوياً بالأسفل"
              : "Copy failed — copy the link below manually"}
        </span>
      )}
      {manualUrl && (
        <span
          className={`absolute top-full mt-6 z-10 flex w-[240px] flex-col gap-1.5 rounded-card border border-line bg-paper p-2.5 shadow-2 ${
            isAr ? "end-0" : "start-0"
          }`}
        >
          <input
            readOnly
            value={manualUrl}
            dir="ltr"
            aria-label={isAr ? "الرابط — حدّده وانسخه يدوياً" : "The link — select and copy it manually"}
            // Selected the instant it renders: on a device that blocked
            // every clipboard API, a long-press "نسخ" from the OS's own
            // text-selection menu is the one path left that no site can
            // block — this just puts the selection there for it.
            onFocus={(e) => e.currentTarget.select()}
            ref={(el) => el?.focus()}
            className="w-full truncate rounded border border-line bg-surface px-2 py-1 text-[12px] text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => setManualUrl(null)}
            className="self-end text-[11px] font-semibold text-ink-3 hover:text-ink"
          >
            {isAr ? "إغلاق" : "Close"}
          </button>
        </span>
      )}
    </span>
  );
}
