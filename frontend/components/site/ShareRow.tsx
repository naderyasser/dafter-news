"use client";

export default function ShareRow({ lang, title }: { lang: "ar" | "en"; title: string }) {
  const isAr = lang === "ar";
  const iconClass =
    "flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-strong text-xs font-bold text-ink-3 hover:border-brand hover:bg-brand hover:text-paper";

  const share = (network: "facebook" | "x" | "copy") => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (network === "copy") {
      navigator.clipboard?.writeText(url);
      return;
    }
    const shareUrl =
      network === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
        : `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <span className="ms-auto flex items-center gap-2">
      <span className={iconClass} title={isAr ? "فيسبوك" : "Facebook"} onClick={() => share("facebook")}>
        f
      </span>
      <span className={iconClass} title="X" onClick={() => share("x")}>
        X
      </span>
      <span className={iconClass} title={isAr ? "نسخ الرابط" : "Copy link"} onClick={() => share("copy")}>
        ↗
      </span>
    </span>
  );
}
