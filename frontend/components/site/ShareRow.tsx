"use client";

import { FacebookGlyph, ShareGlyph, ThreadsGlyph, WhatsAppGlyph, XGlyph } from "@/components/ui/BrandIcons";

type Network = "facebook" | "x" | "threads" | "whatsapp" | "copy";

const PLATFORMS: { key: Network; label: { ar: string; en: string }; Icon: typeof FacebookGlyph; bg: string }[] = [
  { key: "facebook", label: { ar: "فيسبوك", en: "Facebook" }, Icon: FacebookGlyph, bg: "bg-[#1877F2]" },
  { key: "x", label: { ar: "منصة X", en: "X" }, Icon: XGlyph, bg: "bg-ink" },
  { key: "threads", label: { ar: "ثريدز", en: "Threads" }, Icon: ThreadsGlyph, bg: "bg-ink" },
  { key: "whatsapp", label: { ar: "واتساب", en: "WhatsApp" }, Icon: WhatsAppGlyph, bg: "bg-[#25D366]" },
];

export default function ShareRow({ lang, title }: { lang: "ar" | "en"; title: string }) {
  const isAr = lang === "ar";
  const btnClass = "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-paper transition-opacity duration-fast hover:opacity-85";

  const share = (network: Network) => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (network === "copy") {
      navigator.clipboard?.writeText(url);
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

  return (
    <span className="ms-auto flex items-center gap-2">
      {PLATFORMS.map(({ key, label, Icon, bg }) => (
        <span key={key} className={`${btnClass} ${bg}`} title={label[lang]} onClick={() => share(key)}>
          <Icon className="h-4 w-4" />
        </span>
      ))}
      {/* The generic share/copy-link action — unchanged behaviour, just
          restyled to match the platform buttons beside it. */}
      <span
        className={`${btnClass} bg-ink-2`}
        title={isAr ? "نسخ الرابط" : "Copy link"}
        onClick={() => share("copy")}
      >
        <ShareGlyph className="h-4 w-4" />
      </span>
    </span>
  );
}
