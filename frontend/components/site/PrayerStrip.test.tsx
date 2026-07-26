import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PrayerStrip from "./PrayerStrip";
import type { PrayerTimes } from "@/lib/types";

const times = (over: Partial<PrayerTimes> = {}): PrayerTimes => ({
  id: 1,
  city_key: "cairo",
  date: "2026-07-26",
  hijri_date: "١١ صفر ١٤٤٨",
  fajr: "03:29",
  dhuhr: "12:59",
  asr: "16:36",
  maghrib: "19:47",
  isha: "21:15",
  ...over,
});

/** The "next prayer" highlight depends on the wall clock. */
const atClock = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

describe("PrayerStrip", () => {
  afterEach(() => vi.useRealTimers());

  it("renders every prayer with its time", () => {
    atClock("2026-07-26T10:00:00");
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText(/الفجر 03:29/)).toBeInTheDocument();
    expect(screen.getByText(/المغرب 19:47/)).toBeInTheDocument();
  });

  it("renders the Hijri date", () => {
    atClock("2026-07-26T10:00:00");
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText("١١ صفر ١٤٤٨")).toBeInTheDocument();
  });

  it("renders nothing when there is no data", () => {
    // A missed sync must not leave a broken strip in the header.
    const { container } = render(<PrayerStrip times={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("highlights the next prayer, not all of them", () => {
    atClock("2026-07-26T10:00:00"); // between fajr and dhuhr
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText(/الظهر/).className).toContain("text-brand");
    expect(screen.getByText(/الفجر/).className).not.toContain("text-brand");
  });

  it("moves the highlight along as the day passes", () => {
    atClock("2026-07-26T17:00:00"); // between asr and maghrib
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText(/المغرب/).className).toContain("text-brand");
    expect(screen.getByText(/العصر/).className).not.toContain("text-brand");
  });

  it("wraps to tomorrow's fajr after isha", () => {
    atClock("2026-07-26T23:30:00");
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText(/الفجر/).className).toContain("text-brand");
  });

  it("gives the clock values tabular figures so they don't jitter", () => {
    atClock("2026-07-26T10:00:00");
    render(<PrayerStrip times={times()} />);

    expect(screen.getByText(/الفجر/).className).toContain("tnum");
  });

  it("skips a prayer the feed didn't return rather than showing a blank", () => {
    atClock("2026-07-26T10:00:00");
    render(<PrayerStrip times={times({ asr: "" })} />);

    expect(screen.queryByText(/العصر/)).not.toBeInTheDocument();
    expect(screen.getByText(/الظهر/)).toBeInTheDocument();
  });

  it("renders without a Hijri date if the feed omitted it", () => {
    atClock("2026-07-26T10:00:00");
    render(<PrayerStrip times={times({ hijri_date: "" })} />);

    expect(screen.getByText(/الفجر/)).toBeInTheDocument();
  });
});
