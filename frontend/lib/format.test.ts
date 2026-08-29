import { describe, expect, it, vi, afterEach } from "vitest";

import { clockTime, dayBucket, decodeParam, formatDate, publishedLine, readCount, relativeTime, standfirstFor, toDisplayNumerals, withoutSectionPrefix, isArabicScript, isLatinScript } from "./format";

describe("decodeParam", () => {
  it("returns a plain ASCII slug unchanged", () => {
    expect(decodeParam("president-opens-delta-corridor")).toBe("president-opens-delta-corridor");
  });

  it("decodes a singly-encoded Arabic slug", () => {
    expect(decodeParam("%D8%A7%D9%84%D8%B0%D9%87%D8%A8")).toBe("الذهب");
  });

  it("decodes a doubly-encoded Arabic slug", () => {
    // regression: route params are encoded once by the browser and again by
    // middleware, so a single decodeURIComponent left `%D8%A7...` behind and
    // every slug comparison silently failed.
    expect(decodeParam("%25D8%25A7%25D9%2584%25D8%25B0%25D9%2587%25D8%25A8")).toBe("الذهب");
  });

  it("decodes a dashed multi-word Arabic slug", () => {
    const encoded = encodeURIComponent(encodeURIComponent("البنية-التحتية"));

    expect(decodeParam(encoded)).toBe("البنية-التحتية");
  });

  it("leaves an already-decoded Arabic slug alone", () => {
    expect(decodeParam("الذهب")).toBe("الذهب");
  });

  it("returns the input rather than throwing on a malformed escape", () => {
    expect(decodeParam("%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("terminates on input that would decode forever", () => {
    // A '%' that survives decoding must not spin the loop indefinitely.
    expect(() => decodeParam("%2525252525D8%25A7")).not.toThrow();
  });
});

/**
 * The site prints Western digits in both editions — the newsroom's call.
 * These pin that the helper does NOT reintroduce Eastern numerals, which is
 * what it used to do under its old name (toEasternNumerals).
 */
describe("toDisplayNumerals", () => {
  it("keeps Western digits as they are", () => {
    expect(toDisplayNumerals(1)).toBe("1");
    expect(toDisplayNumerals(10)).toBe("10");
    expect(toDisplayNumerals(214)).toBe("214");
  });

  it("never emits an Eastern Arabic digit", () => {
    expect(toDisplayNumerals("0123456789")).toBe("0123456789");
    expect(/[٠-٩]/.test(toDisplayNumerals("0123456789"))).toBe(false);
  });

  it("leaves non-digit characters untouched", () => {
    expect(toDisplayNumerals("12-34")).toBe("12-34");
  });
});

describe("relativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  it("returns an empty string for a missing timestamp", () => {
    expect(relativeTime(null, "ar")).toBe("");
    expect(relativeTime(undefined, "en")).toBe("");
  });

  it("reports minutes for a recent timestamp", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-26T11:30:00Z", "ar")).toBe("منذ 30 دقيقة");
    expect(relativeTime("2026-07-26T11:30:00Z", "en")).toBe("30m ago");
  });

  it("uses the singular hour form in Arabic", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-26T11:00:00Z", "ar")).toBe("منذ ساعة");
  });

  it("uses the plural hour form in Arabic", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-26T09:00:00Z", "ar")).toBe("منذ 3 ساعات");
  });

  it("says yesterday at the one-day boundary", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-25T12:00:00Z", "ar")).toBe("أمس");
    expect(relativeTime("2026-07-25T12:00:00Z", "en")).toBe("Yesterday");
  });

  it("reports days beyond that", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-22T12:00:00Z", "ar")).toBe("منذ 4 أيام");
    expect(relativeTime("2026-07-22T12:00:00Z", "en")).toBe("4d ago");
  });

  it("does not produce a negative age for a future timestamp", () => {
    at("2026-07-26T12:00:00Z");

    expect(relativeTime("2026-07-26T18:00:00Z", "ar")).toBe("الآن");
  });
});

describe("formatDate", () => {
  it("returns an empty string for a missing date", () => {
    expect(formatDate(null, "ar")).toBe("");
  });

  it("formats an English date in long form", () => {
    expect(formatDate("2026-07-25T10:00:00Z", "en")).toContain("2026");
    expect(formatDate("2026-07-25T10:00:00Z", "en")).toContain("July");
  });

  it("formats an Arabic date using the Arabic locale", () => {
    const formatted = formatDate("2026-07-25T10:00:00Z", "ar");

    expect(formatted).not.toBe("");
    expect(formatted).toMatch(/[؀-ۿ]/); // contains Arabic script
  });
});

describe("publishedLine", () => {
  it("returns an empty string for a missing or invalid date", () => {
    expect(publishedLine(null, "ar")).toBe("");
    expect(publishedLine("not-a-date", "ar")).toBe("");
  });

  it("reads «نُشر في <يوم> <تاريخ>، <ساعة 12>» — regression: the newsroom's own reference example", () => {
    // 22:30 local time — the exact case the client flagged: a 24h "23:xx"
    // reads wrong to a reader used to news-style publish lines.
    const evening = new Date(2026, 7, 12, 22, 30); // Wed 12 Aug 2026, 22:30
    const line = publishedLine(evening.toISOString(), "ar");

    expect(line.startsWith("نُشر في ")).toBe(true);
    expect(line).toContain("الأربعاء");
    expect(line).toContain("أغسطس");
    expect(line).toMatch(/م$/); // 22:30 is PM — «م», never «ص»
    expect(line).not.toMatch(/٢٢|22/); // never the 24h hour
    // exactly one comma, immediately before the time — not one after the
    // weekday too (Intl's own combined weekday+date format would add that).
    expect(line.split("،")).toHaveLength(2);
  });

  it("writes a morning hour as «ص», not «م»", () => {
    const morning = new Date(2026, 7, 12, 3, 5);
    expect(publishedLine(morning.toISOString(), "ar")).toMatch(/ص$/);
  });

  it("formats in English as a 12-hour clock with AM/PM", () => {
    const evening = new Date(2026, 7, 12, 22, 30);
    const line = publishedLine(evening.toISOString(), "en");

    expect(line.startsWith("Published ")).toBe(true);
    expect(line).toContain("Wednesday");
    expect(line).toContain("August");
    expect(line).toMatch(/PM$/);
  });
});

describe("standfirstFor", () => {
  /**
   * 61 of the 63 published stories carry a standfirst identical to their
   * headline. Printing both was the loudest "generated page" tell on the site,
   * so this helper is what every front leans on to avoid it.
   */
  it("drops a standfirst that merely repeats the headline", () => {
    const title = "البنك المركزي يثبّت أسعار الفائدة";
    expect(standfirstFor(title, title)).toBeUndefined();
  });

  it("drops one that differs only by punctuation, spacing or كشيدة", () => {
    const title = "البنك المركزي يثبّت أسعار الفائدة";
    expect(standfirstFor(title, "البنك  المركزي يثبّت أسعار الفائدة.")).toBeUndefined();
    expect(standfirstFor(title, "البنك المركزي يثبّت أسعار الفائدة،")).toBeUndefined();
  });

  it("drops one that is the headline cut short or extended", () => {
    const title = "البنك المركزي يثبّت أسعار الفائدة";
    expect(standfirstFor(title, "البنك المركزي يثبّت")).toBeUndefined();
    expect(standfirstFor(title, `${title} للاجتماع الثالث`)).toBeUndefined();
  });

  it("keeps a standfirst that says something new", () => {
    const standfirst = "القرار جاء بعد تراجع التضخم للشهر الرابع على التوالي";
    expect(standfirstFor("البنك المركزي يثبّت أسعار الفائدة", standfirst)).toBe(standfirst);
  });

  it("treats an empty or missing standfirst as nothing to print", () => {
    expect(standfirstFor("عنوان", "")).toBeUndefined();
    expect(standfirstFor("عنوان", null)).toBeUndefined();
    expect(standfirstFor("عنوان", "   ")).toBeUndefined();
  });
});

describe("dayBucket", () => {
  it("groups by calendar day, not by elapsed hours", () => {
    // 23:50 and 00:10 are twenty minutes apart and belong to different days.
    const late = new Date();
    late.setHours(23, 50, 0, 0);
    expect(dayBucket(late.toISOString(), "ar")).toBe("اليوم");
  });

  it("names yesterday rather than counting back to it", () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(dayBucket(y.toISOString(), "ar")).toBe("أمس");
    expect(dayBucket(y.toISOString(), "en")).toBe("Yesterday");
  });

  it("files an undated draft under «الأحدث» rather than inventing a date", () => {
    expect(dayBucket(null, "ar")).toBe("الأحدث");
    expect(dayBucket("not-a-date", "ar")).toBe("الأحدث");
  });
});

describe("clockTime", () => {
  it("writes midnight as 00, never as 24", () => {
    // `hour12: false` resolves to the h24 cycle, where 00:04 is written 24:04 —
    // a time that does not exist, on every story filed in the small hours.
    const midnight = new Date(2026, 6, 27, 0, 4);
    expect(clockTime(midnight.toISOString(), "en")).toBe("00:04");
  });

  it("returns nothing for a story with no timestamp", () => {
    expect(clockTime(null, "ar")).toBe("");
  });
});

describe("withoutSectionPrefix", () => {
  it("strips the desk's own name from its headlines", () => {
    expect(withoutSectionPrefix("دليلك الأول: تجديد رخصة القيادة", "دليلك الأول")).toBe("تجديد رخصة القيادة");
  });

  it("leaves a headline that only happens to begin with the same word", () => {
    const title = "دليلك الأول لفهم قانون الإيجار";
    expect(withoutSectionPrefix(title, "دليلك الأول")).toBe(title);
  });

  it("never strips a headline down to nothing", () => {
    expect(withoutSectionPrefix("دليلك الأول:", "دليلك الأول")).toBe("دليلك الأول:");
  });

  it("is a no-op without a section name", () => {
    expect(withoutSectionPrefix("عنوان", undefined)).toBe("عنوان");
  });
});

describe("script detection", () => {
  it("recognises Arabic text", () => {
    expect(isArabicScript("محور الدلتا")).toBe(true);
    expect(isArabicScript("Delta corridor")).toBe(false);
  });

  it("treats a mixed headline as Arabic", () => {
    // A story rail's title column holds both editions with no language
    // column beside it, and «صلاح» in a Latin sentence still belongs to the
    // Arabic edition.
    expect(isArabicScript("Mohamed صلاح")).toBe(true);
  });

  it("counts Eastern digits as Arabic", () => {
    expect(isArabicScript("٢٠٢٦")).toBe(true);
  });

  it("gives digits and punctuation to the English edition", () => {
    // isLatinScript is "not Arabic", deliberately: a positive A-Z test would
    // fail a headline that is all numerals.
    expect(isLatinScript("2026 — 60%")).toBe(true);
    expect(isLatinScript("")).toBe(true);
  });

  it("is the exact inverse of the Arabic test", () => {
    for (const sample of ["محور", "Delta", "", "٢٠٢٦", "Mohamed صلاح"]) {
      expect(isLatinScript(sample)).toBe(!isArabicScript(sample));
    }
  });
});

describe("readCount", () => {
  it("uses the Arabic plural for a tail of three to ten", () => {
    // 3–10 take the plural: «5 قراءات», not «5 قراءة».
    expect(readCount(5, "ar")).toBe("5 قراءات");
    expect(readCount(9, "ar")).toBe("9 قراءات");
    expect(readCount(10, "ar")).toBe("10 قراءات");
  });

  it("uses the Arabic singular from eleven upward", () => {
    expect(readCount(11, "ar")).toBe("11 قراءة");
    expect(readCount(150, "ar")).toBe("150 قراءة");
  });

  it("counts by the last two digits, not the magnitude", () => {
    // The rule that catches people out: 103 is plural because its tail is 3,
    // while 111 is singular because its tail is 11.
    expect(readCount(103, "ar")).toBe("103 قراءات");
    expect(readCount(111, "ar")).toBe("111 قراءة");
    expect(readCount(100, "ar")).toBe("100 قراءة");
  });

  it("gives one and two their own forms rather than a digit", () => {
    expect(readCount(1, "ar")).toBe("قراءة واحدة");
    expect(readCount(2, "ar")).toBe("قراءتان");
  });

  it("prints zero rather than pretending a story has no count", () => {
    expect(readCount(0, "ar")).toBe("0 قراءة");
  });

  it("groups thousands in Western numerals", () => {
    // The separator is whatever ar-EG uses (a comma or U+066C); the digits
    // either side of it are what this pins.
    expect(readCount(31822, "ar")).toMatch(/^31.822 قراءة$/);
  });

  it("reads plainly in English", () => {
    expect(readCount(1, "en")).toBe("1 read");
    expect(readCount(1500, "en")).toBe("1,500 reads");
    expect(readCount(0, "en")).toBe("0 reads");
  });

  it("treats a missing or negative count as zero", () => {
    // ArticleCard.views is non-null from the API, but the prop is optional on
    // the widget and a negative count is not a thing to render literally.
    expect(readCount(null, "ar")).toBe("0 قراءة");
    expect(readCount(undefined, "en")).toBe("0 reads");
    expect(readCount(-5, "en")).toBe("0 reads");
  });
});

/**
 * The site-wide decision, pinned at the source.
 *
 * Eastern numerals used to leak in from two places: the "ar-EG" locale
 * (Intl's default numbering system for it) and a hand-rolled digit table
 * that had been copied into a component. Both are gone; these assert the
 * formatters themselves, so a future call site cannot reintroduce them by
 * reaching for a plain "ar-EG".
 */
describe("Western digits, site-wide", () => {
  const EASTERN = /[٠-٩]/;

  it("formats a date with Arabic month names but Western digits", () => {
    const out = formatDate("2026-08-29T12:00:00Z", "ar");

    expect(out).toContain("أغسطس");
    expect(out).toContain("2026");
    expect(EASTERN.test(out)).toBe(false);
  });

  it("keeps the publish line free of Eastern digits", () => {
    const out = publishedLine("2026-08-29T17:37:00Z", "ar");

    expect(out).toContain("نُشر في");
    expect(EASTERN.test(out)).toBe(false);
  });

  it("keeps the clock and the day bucket free of Eastern digits", () => {
    expect(EASTERN.test(clockTime("2026-08-29T09:05:00Z", "ar"))).toBe(false);
    expect(EASTERN.test(dayBucket("2026-01-14T09:05:00Z", "ar"))).toBe(false);
  });

  it("keeps read counts free of Eastern digits, separator included", () => {
    expect(EASTERN.test(readCount(31822, "ar"))).toBe(false);
  });
});
