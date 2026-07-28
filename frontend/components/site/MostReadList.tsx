import Link from "next/link";

const EASTERN = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
const toRank = (n: number, isAr: boolean) => (isAr ? String(n).split("").map((d) => EASTERN[+d]).join("") : String(n));

export type MostReadItem = { title: string; href: string; section?: string; imageSrc?: string };

export default function MostReadList({
  lang,
  items,
  heading,
}: {
  lang: "ar" | "en";
  items: MostReadItem[];
  heading?: string;
}) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  return (
    <aside className="rounded-card border border-line bg-paper p-5">
      <div className={`${fontDisplay} rule-accent ps-3.5 text-[17px] font-extrabold text-ink`}>
        {heading ?? (isAr ? "الأكثر قراءة" : "Most read")}
      </div>
      <div className="flex flex-col">
        {items.map((it, i) => (
          <Link
            key={it.href + i}
            href={it.href}
            className={`flex items-start gap-3.5 py-3.5 no-underline ${i === items.length - 1 ? "" : "border-b border-line"}`}
          >
            <span className="tnum min-w-[28px] flex-shrink-0 text-[26px] font-extrabold leading-none text-brand">
              {toRank(i + 1, isAr)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[14px] font-semibold leading-[1.5] text-ink">{it.title}</span>
              {it.section && <span className="text-caption text-ink-3">{it.section}</span>}
            </span>
            {/* Thumbnail sits at the inline end so the rank column stays the
                reading anchor and the numbers line up down the list. */}
            {it.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.imageSrc}
                alt=""
                className="h-[52px] w-[68px] flex-shrink-0 rounded object-cover"
              />
            ) : (
              <span className="h-[52px] w-[68px] flex-shrink-0 rounded bg-surface-2" />
            )}
          </Link>
        ))}
      </div>
    </aside>
  );
}
