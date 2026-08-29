import { describe, expect, it, vi, afterEach } from "vitest";

import { clockTime, dayBucket, decodeParam, formatDate, publishedLine, readCount, relativeTime, standfirstFor, toEasternNumerals, withoutSectionPrefix, isArabicScript, isLatinScript } from "./format";

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

describe("toEasternNumerals", () => {
  it("converts Western digits to Eastern Arabic digits", () => {
    expect(toEasternNumerals(1)).toBe("١");
    expect(toEasternNumerals(10)).toBe("١٠");
    expect(toEasternNumerals(214)).toBe("٢١٤");
  });

  it("converts every digit", () => {
    expect(toEasternNumerals("0123456789")).toBe("٠١٢٣٤٥٦٧٨٩");
  });

  it("leaves non-digit characters untouched", () => {
    expect(toEasternNumerals("12-34")).toBe("١٢-٣٤");
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
    // ٣–١٠ take the plural: «٥ قراءات», not «٥ قراءة».
    expect(readCount(5, "ar")).toBe("٥ قراءات");
    expect(readCount(9, "ar")).toBe("٩ قراءات");
    expect(readCount(10, "ar")).toBe("١٠ قراءات");
  });

  it("uses the Arabic singular from eleven upward", () => {
    expect(readCount(11, "ar")).toBe("١١ قراءة");
    expect(readCount(150, "ar")).toBe("١٥٠ قراءة");
  });

  it("counts by the last two digits, not the magnitude", () => {
    // The rule that catches people out: 103 is plural because its tail is 3,
    // while 111 is singular because its tail is 11.
    expect(readCount(103, "ar")).toBe("١٠٣ قراءات");
    expect(readCount(111, "ar")).toBe("١١١ قراءة");
    expect(readCount(100, "ar")).toBe("١٠٠ قراءة");
  });

  it("gives one and two their own forms rather than a digit", () => {
    expect(readCount(1, "ar")).toBe("قراءة واحدة");
    expect(readCount(2, "ar")).toBe("قراءتان");
  });

  it("prints zero rather than pretending a story has no count", () => {
    expect(readCount(0, "ar")).toBe("٠ قراءة");
  });

  it("groups thousands in Eastern numerals", () => {
    expect(readCount(31822, "ar")).toMatch(/^٣١.٨٢٢ قراءة$/);
  });

  it("reads plainly in English", () => {
    expect(readCount(1, "en")).toBe("1 read");
    expect(readCount(1500, "en")).toBe("1,500 reads");
    expect(readCount(0, "en")).toBe("0 reads");
  });

  it("treats a missing or negative count as zero", () => {
    // ArticleCard.views is non-null from the API, but the prop is optional on
    // the widget and a negative count is not a thing to render literally.
    expect(readCount(null, "ar")).toBe("٠ قراءة");
    expect(readCount(undefined, "en")).toBe("0 reads");
    expect(readCount(-5, "en")).toBe("0 reads");
  });
});
