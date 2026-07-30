import Link from "next/link";

import Chevron from "@/components/ui/Chevron";
import CoverImage from "@/components/ui/CoverImage";
import type { TickerPayload } from "@/lib/types";
import type { FrontProps } from "./types";

const T = {
  ar: { drop: "أفلت صورة الخبر هنا", full: "الأسعار كاملة", gold: "ذهب", analysis: "التحليل", empty: "لا تحليلات على هذا المكتب بعد." },
  en: { drop: "Drop image here", full: "All prices", gold: "Gold", analysis: "Analysis", empty: "Nothing on this desk yet." },
};

/**
 * A plate's seven-day trend, drawn from the series the ticker already sends.
 *
 * Deliberately `aria-hidden`: the plate states the same movement twice over in
 * text — a signed percentage and a ▲/▼ — so a screen reader gets the fact
 * without a shape it cannot see, and a colourblind reader is never asked to
 * tell red from green unaided. Two-pixel stroke, no axes, no markers, no
 * tooltip; the full board with its own numbers lives at /markets, which is
 * where the plate links.
 */
function Sparkline({ series, up }: { series: number[]; up: boolean }) {
  if (!series || series.length < 2) return null;
  const w = 66;
  const h = 22;
  const pad = 2;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const points = series
    .map((v, i) => {
      const x = pad + (i / (series.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className={`mt-1.5 ${up ? "text-up-dark" : "text-down-dark"}`} aria-hidden focusable="false">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * «حركة السوق» — the board.
 *
 * The desk's own tagline is «الأرقام أولاً ثم التحليل», so the numbers are
 * not an opening module above a news page — they *are* the masthead. The
 * section name, the rates, the gold karats and their week all sit on one dark
 * board, and the journalism starts underneath it.
 *
 * This is the only front on the site whose hero is data rather than a
 * photograph, which is the right way round for the one desk where a reader
 * arrives wanting a figure and only then wants an explanation.
 */
export default function MarketsFront({ lang, accent, title, tagline, stories, ticker }: FrontProps & { ticker?: TickerPayload | null }) {
  const isAr = lang === "ar";
  const t = T[lang];
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";
  const accentVar = { "--card-accent": accent } as React.CSSProperties;
  const [lead, ...rest] = stories;

  const currencies = [...(ticker?.currencies ?? [])].sort((a, b) => a.order - b.order).slice(0, 4);
  const gold = [...(ticker?.gold ?? [])].sort((a, b) => a.order - b.order).slice(0, 2);
  const plates = currencies.length + gold.length;

  return (
    <>
      <header className="mb-8 overflow-hidden rounded-card bg-navy-strong">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 pb-5 pt-6 sm:px-7">
          <div>
            <h1 className={`${fontDisplay} m-0 text-[clamp(1.75rem,1.2rem+2.2vw,2.75rem)] font-extrabold leading-[1.2] text-paper`}>{title}</h1>
            {tagline && <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.7] text-header-muted">{tagline}</p>}
          </div>
          <Link href="/markets" className="flex items-center gap-1.5 text-[13px] font-bold text-gold-dark no-underline hover:text-paper">
            {t.full}
            <Chevron lang={lang} className="h-3.5 w-3.5" />
          </Link>
        </div>

        {plates > 0 && (
          <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,.1)] sm:grid-cols-3 lg:grid-cols-6">
            {currencies.map((c) => (
              <Link key={c.id} href="/markets" className="bg-navy-strong px-4 py-3.5 no-underline transition-colors duration-fast hover:bg-navy">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-header-muted">
                  <span aria-hidden>{c.flag_emoji}</span>
                  <span className="font-body-en">{c.code}</span>
                </div>
                <div className="tnum mt-1 text-[19px] font-extrabold text-paper">{c.sell}</div>
                <div className={`tnum mt-0.5 text-[12px] font-bold ${c.is_up ? "text-up-dark" : "text-down-dark"}`}>
                  <span aria-hidden>{c.is_up ? "▲" : "▼"}</span> {c.change_pct}%
                </div>
                <Sparkline series={c.series} up={c.is_up} />
              </Link>
            ))}
            {gold.map((g) => (
              <Link key={g.id} href="/markets" className="bg-navy-strong px-4 py-3.5 no-underline transition-colors duration-fast hover:bg-navy">
                <div className="text-[12px] font-bold text-gold-dark">
                  {t.gold} · {g.label}
                </div>
                <div className="tnum mt-1 text-[19px] font-extrabold text-paper">{g.price}</div>
                <div className={`tnum mt-0.5 text-[12px] font-bold ${g.is_up ? "text-up-dark" : "text-down-dark"}`}>
                  <span aria-hidden>{g.is_up ? "▲" : "▼"}</span> {g.change_pct}%
                </div>
              </Link>
            ))}
          </div>
        )}
      </header>

      {!lead && <p className="border-y border-line py-10 text-center text-[15px] text-ink-3">{t.empty}</p>}

      {lead && (
        <Link href={lead.href} className="card-link mb-8 block no-underline" style={accentVar}>
          <article className="grid gap-5 sm:grid-cols-[1.15fr_1fr] sm:items-center">
            <div className="relative aspect-[16/10] overflow-hidden rounded-card">
              <CoverImage src={lead.imageSrc} alt={lead.title} placeholder={t.drop} className="absolute inset-0" sizes="(min-width: 768px) 45vw, 100vw" />
            </div>
            <div>
              <h2 className={`${fontDisplay} card-title m-0 text-[clamp(1.25rem,1rem+1.4vw,1.75rem)] font-extrabold leading-[1.45] text-ink`}>{lead.title}</h2>
              {lead.standfirst && <p className="mt-2 text-[15px] leading-[1.75] text-ink-2">{lead.standfirst}</p>}
              {lead.time && <div className="mt-2 text-[13px] font-semibold text-ink-3">{lead.time}</div>}
            </div>
          </article>
        </Link>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className={`${fontDisplay} m-0 border-b-2 border-gold pb-2 text-[15px] font-extrabold text-gold`}>{t.analysis}</h2>
          {/* No photographs below the lead. On a desk read for figures, a row
              of stock skylines adds nothing a headline does not already say. */}
          <div className="grid gap-x-7 sm:grid-cols-2">
            {rest.map((s) => (
              <Link key={s.id} href={s.href} className="card-link block border-b border-line py-4 no-underline" style={accentVar}>
                <h3 className={`${fontDisplay} card-title m-0 text-[15px] font-extrabold leading-[1.65] text-ink`}>{s.title}</h3>
                {s.standfirst && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.7] text-ink-2">{s.standfirst}</p>}
                {s.time && <div className="mt-1.5 text-[12px] font-semibold text-ink-3">{s.time}</div>}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
