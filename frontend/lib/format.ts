export function relativeTime(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.round((now - then) / 60000));
  const isAr = lang === "ar";
  if (diffMin < 1) return isAr ? "الآن" : "just now";
  if (diffMin < 60) return isAr ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return isAr ? (diffHr === 1 ? "منذ ساعة" : `منذ ${diffHr} ساعات`) : `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 2) return isAr ? "أمس" : "Yesterday";
  return isAr ? `منذ ${diffDay} أيام` : `${diffDay}d ago`;
}

export function formatDate(iso: string | null | undefined, lang: "ar" | "en"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export const toEasternNumerals = (n: number | string) => String(n).split("").map((d) => (EASTERN[+d] ?? d)).join("");
