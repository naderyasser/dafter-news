import Link from "next/link";

import Chevron from "@/components/ui/Chevron";
import type { TickerPayload } from "@/lib/types";

const T = {
  ar: { gold: "الذهب", full: "الأسعار كاملة", buy: "شراء", sell: "بيع" },
  en: { gold: "Gold", full: "All prices", buy: "Buy", sell: "Sell" },
};

/**
 * The market desk's opening module: today's numbers, inline.
 *
 * Not MarketsTicker — that component is the site-wide `fixed bottom-0` bar,
 * and mounting it inside a page just paints a second invisible bar under
 * the first. This takes the same payload and lays it out as page content:
 * the top currencies with buy/sell and the gold karats, linking to the
 * full /markets board.
 */
export default function MarketsSnapshot({ lang, data }: { lang: "ar" | "en"; data: TickerPayload }) {
  const t = T[lang];
  const currencies = [...data.currencies].sort((a, b) => a.order - b.order).slice(0, 4);
  const gold = [...data.gold].sort((a, b) => a.order - b.order).slice(0, 2);
  if (!currencies.length && !gold.length) return null;

  return (
    <div className="mb-7 rounded-card border border-line bg-paper">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-t-card bg-line sm:grid-cols-3 lg:grid-cols-6">
        {currencies.map((c) => (
          <div key={c.id} className="bg-paper px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-ink-3">
              <span>{c.flag_emoji}</span>
              <span className="font-body-en">{c.code}</span>
            </div>
            <div className="tnum mt-1 text-[17px] font-extrabold text-ink">{c.sell}</div>
            <div className={`tnum mt-0.5 text-[11.5px] font-bold ${c.is_up ? "text-up" : "text-down"}`}>
              {c.is_up ? "▲" : "▼"} {c.change_pct}%
            </div>
          </div>
        ))}
        {gold.map((g) => (
          <div key={g.id} className="bg-paper px-3.5 py-3">
            <div className="text-[12px] font-bold text-gold">
              {t.gold} · {g.label}
            </div>
            <div className="tnum mt-1 text-[17px] font-extrabold text-ink">{g.price}</div>
            <div className={`tnum mt-0.5 text-[11.5px] font-bold ${g.is_up ? "text-up" : "text-down"}`}>
              {g.is_up ? "▲" : "▼"} {g.change_pct}%
            </div>
          </div>
        ))}
      </div>
      <Link
        href={lang === "ar" ? "/markets" : "/markets"}
        className="flex items-center justify-center gap-1.5 border-t border-line py-2.5 text-[13px] font-bold text-accent no-underline hover:text-brand"
      >
        {t.full}
        <Chevron lang={lang} className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
