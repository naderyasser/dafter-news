import Link from "next/link";

import type { TickerPayload } from "@/lib/types";

const AR_LABELS: Record<string, string> = {
  USD: "دولار/جنيه",
  EUR: "يورو/جنيه",
  GBP: "إسترليني/جنيه",
  SAR: "ريال سعودي/جنيه",
  // AED and KWD are in the provider's TRACKED list but were missing here, so
  // the Arabic bar fell through to the bare ISO code for both.
  AED: "درهم إماراتي/جنيه",
  KWD: "دينار كويتي/جنيه",
};

// GoldKarat.label and WeatherCity.label are single-language columns holding
// Arabic, so the English bar rendered "عيار 21" verbatim. Map at the view
// layer — same approach AR_LABELS already takes for currency codes — rather
// than adding a second column to a table the dashboard edits by hand.
const EN_GOLD: Record<string, string> = {
  "عيار 24": "Gold 24K",
  "عيار 21": "Gold 21K",
  "عيار 18": "Gold 18K",
  "جنيه ذهب": "Gold pound",
};

const EN_CITY: Record<string, string> = {
  cairo: "Cairo",
  alex: "Alexandria",
  luxor: "Luxor",
  aswan: "Aswan",
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
 *
 * The rates scroll continuously as a ticker tape. The track holds two
 * identical copies of the row and translates by exactly 50%, so the loop
 * restarts on a frame where copy B sits precisely where copy A began —
 * that's what makes it read as endless rather than as a jump. Motion pauses
 * on hover so a reader can actually take a number in.
 */
export default function MarketsTicker({ lang, data }: { lang: "ar" | "en"; data: TickerPayload }) {
  const isAr = lang === "ar";
  const fontBody = isAr ? "font-body-ar" : "font-body-en";
  const gold = data.gold.find((g) => g.label.includes("21")) ?? data.gold[0];
  const weather = data.weather;

  const items = [
    ...data.currencies.map((c) => (
      <div key={`c-${c.code}`} className="flex flex-shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? AR_LABELS[c.code] ?? c.code : `${c.code}/EGP`}</span>
        <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{c.sell}</span>
        <Chip up={c.is_up}>
          {c.is_up ? "▲" : "▼"} {c.change_pct}%
        </Chip>
      </div>
    )),
    ...data.gold.map((g) => (
      <div key={`g-${g.label}`} className="flex flex-shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[13px] text-ink-3">{isAr ? `ذهب ${g.label}` : EN_GOLD[g.label] ?? g.label}</span>
        <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{g.price}</span>
        <Chip up={g.is_up}>
          {g.is_up ? "▲" : "▼"} {g.change_pct}%
        </Chip>
      </div>
    )),
    weather ? (
      <div key="w" className="flex flex-shrink-0 items-center gap-2">
        <span className="whitespace-nowrap text-[13px] text-ink-3">
          {isAr ? weather.label : EN_CITY[weather.key] ?? weather.key} {weather.icon}
        </span>
        <span className="tnum whitespace-nowrap text-[14px] font-bold text-ink">{weather.temp}°</span>
      </div>
    ) : null,
  ].filter(Boolean);

  const strip = (copy: string) => (
    <div className="flex flex-shrink-0 items-center gap-7 pe-7" aria-hidden={copy === "b"}>
      {items.map((item, i) => (
        <div key={`${copy}-${i}`} className="flex items-center gap-7">
          {item}
          <span className="h-4 w-px flex-shrink-0 bg-line" />
        </div>
      ))}
    </div>
  );

  return (
    <Link
      href={isAr ? "/markets" : "/en"}
      aria-label={isAr ? "الأسواق" : "Markets"}
      className={`${fontBody} fixed inset-x-0 bottom-0 z-40 block h-[52px] overflow-hidden border-t border-line bg-paper shadow-sticky`}
    >
      <div className="mx-auto flex h-full max-w-container items-center overflow-hidden px-6">
        {items.length ? (
          <div
            className={`flex min-w-full items-center ${
              isAr ? "animate-ticker-rtl" : "animate-ticker-ltr"
            } motion-reduce:animate-none hover:[animation-play-state:paused]`}
          >
            {strip("a")}
            {strip("b")}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
