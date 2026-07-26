import Link from "next/link";

import type { TickerPayload } from "@/lib/types";

const AR_LABELS: Record<string, string> = {
  USD: "دولار/جنيه",
  EUR: "يورو/جنيه",
  GBP: "إسترليني/جنيه",
  SAR: "ريال سعودي/جنيه",
};

function Chip({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`tnum flex items-center gap-0.5 whitespace-nowrap rounded-pill px-1.5 py-0.5 text-xs font-bold ${
        up ? "bg-up-tint text-up" : "bg-down-tint text-down"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Sticky bottom bar on every public page (brief §6/§5 — every page reserves
 * 52px at the bottom for this). The whole bar is one link to /markets.
 */
export default function MarketsTicker({ lang, data }: { lang: "ar" | "en"; data: TickerPayload }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const currencies = data.currencies.slice(0, 2);
  const gold = data.gold.find((g) => g.label.includes("21")) ?? data.gold[0];
  const weather = data.weather;

  return (
    <Link
      href={isAr ? "/markets" : "/en"}
      className={`${fontBody} fixed inset-x-0 bottom-0 z-40 block h-[52px] border-t border-line bg-paper shadow-sticky`}
    >
      <div className="mx-auto flex h-full max-w-container items-center gap-7 overflow-x-auto px-6">
        {currencies.map((c) => (
          <div key={c.code} className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? AR_LABELS[c.code] ?? c.code : `${c.code}/EGP`}</span>
            <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{c.sell}</span>
            <Chip up={c.is_up}>
              {c.is_up ? "▲" : "▼"} {c.change_pct}%
            </Chip>
          </div>
        ))}
        {gold && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? `ذهب ${gold.label}` : gold.label}</span>
            <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{gold.price}</span>
            <Chip up={gold.is_up}>
              {gold.is_up ? "▲" : "▼"} {gold.change_pct}%
            </Chip>
          </div>
        )}
        {weather && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-[13px] text-ink-3">
              {isAr ? weather.label : weather.key} {weather.icon}
            </span>
            <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{weather.temp}°</span>
          </div>
        )}
      </div>
    </Link>
  );
}
