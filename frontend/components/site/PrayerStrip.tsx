import type { PrayerTimes } from "@/lib/types";

const ORDER: { key: keyof PrayerTimes; label: string }[] = [
  { key: "fajr", label: "الفجر" },
  { key: "dhuhr", label: "الظهر" },
  { key: "asr", label: "العصر" },
  { key: "maghrib", label: "المغرب" },
  { key: "isha", label: "العشاء" },
];

/**
 * Prayer times + Hijri date in the topbar.
 *
 * The next prayer is highlighted rather than every time given equal weight —
 * "what's next" is the question a reader glancing at this actually has. The
 * comparison is done on the "HH:MM" strings, which sort lexicographically
 * for zero-padded 24-hour clock values, so no date parsing is involved.
 */
function nextPrayerKey(times: PrayerTimes, now: Date): string | null {
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  for (const { key } of ORDER) {
    const value = times[key] as string;
    if (value && value > hhmm) return key as string;
  }
  // Past isha — the next one is tomorrow's fajr.
  return "fajr";
}

export default function PrayerStrip({ times }: { times: PrayerTimes | null }) {
  if (!times) return null;
  const next = nextPrayerKey(times, new Date());

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {times.hijri_date ? (
        <span className="whitespace-nowrap text-[12.5px] text-header-ink">{times.hijri_date}</span>
      ) : null}
      <span className="hidden h-3 w-px bg-ink-2 sm:block" />
      <div className="hidden items-center gap-2.5 sm:flex">
        {ORDER.map(({ key, label }) => {
          const value = times[key] as string;
          if (!value) return null;
          const isNext = key === next;
          return (
            <span
              key={key as string}
              className={`tnum whitespace-nowrap text-[12px] ${
                isNext ? "font-bold text-brand" : "text-header-muted"
              }`}
            >
              {label} {value}
            </span>
          );
        })}
      </div>
    </div>
  );
}
