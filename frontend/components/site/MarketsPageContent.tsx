"use client";

import { useState } from "react";

import type { Currency, GoldKarat, WeatherCity } from "@/lib/types";

function sparklinePoints(series: number[]) {
  const w = 60;
  const h = 22;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  return series.map((v, i) => `${(i * (w / (series.length - 1))).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
}

function Chip({ up, children }: { up: boolean; children: React.ReactNode }) {
  return (
    <span className={`tnum inline-flex items-center rounded-pill px-1.5 py-0.5 text-[11px] font-bold ${up ? "bg-up-tint text-up" : "bg-down-tint text-down"}`}>
      {children}
    </span>
  );
}

export default function MarketsPageContent({
  currencies,
  gold,
  cities,
}: {
  currencies: Currency[];
  gold: GoldKarat[];
  cities: WeatherCity[];
}) {
  const [cityKey, setCityKey] = useState(cities[0]?.key ?? "cairo");
  const weather = cities.find((c) => c.key === cityKey) ?? cities[0];

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-5">
      <div className="rounded-card border border-line bg-paper p-5">
        <div className="mb-3.5 text-[16px] font-extrabold text-ink">أسعار العملات</div>
        <div className="flex flex-col">
          {currencies.map((c) => (
            <div key={c.code} className="flex items-center gap-2.5 border-b border-line py-3 last:border-b-0">
              <span className="text-[20px]">{c.flag_emoji}</span>
              <span className="w-11 text-[14px] font-bold">{c.code}</span>
              <svg width="60" height="22" viewBox="0 0 60 22" className="flex-shrink-0">
                <polyline points={sparklinePoints(c.series)} fill="none" stroke={c.is_up ? "#0E8A4C" : "#C93030"} strokeWidth={2} />
              </svg>
              <span className="ms-auto text-end">
                <div className="tnum text-[14px] font-bold">{c.sell}</div>
                <div className="tnum text-[11px] text-ink-3">شراء {c.buy}</div>
              </span>
              <Chip up={c.is_up}>
                {c.is_up ? "▲" : "▼"} {c.change_pct}%
              </Chip>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-line bg-paper p-5">
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[16px] font-extrabold text-ink">أسعار الذهب</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-up">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-up" />
            تحديث مباشر
          </span>
        </div>
        <div className="flex flex-col">
          {gold.map((g) => (
            <div key={g.label} className="flex items-center gap-2.5 border-b border-line py-3 last:border-b-0">
              <span className="text-[14px] font-bold">{g.label}</span>
              <span className="tnum ms-auto text-[14px] font-bold">{g.price} ج.م</span>
              <Chip up={g.is_up}>
                {g.is_up ? "▲" : "▼"} {g.change_pct}%
              </Chip>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-card border border-line bg-paper p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {cities.map((c) => (
            <button
              key={c.key}
              onClick={() => setCityKey(c.key)}
              className={`rounded-pill border px-3.5 py-1.5 text-xs font-semibold ${
                cityKey === c.key ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {weather && (
          <div className="flex items-center gap-4">
            <span className="text-[44px]">{weather.icon}</span>
            <div>
              <div className="tnum text-[44px] font-extrabold leading-none text-ink">{weather.temp}°</div>
              <div className="mt-1.5 text-[13px] text-ink-3">
                عليا {weather.hi}° • دنيا {weather.lo}° • رطوبة {weather.humidity}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
