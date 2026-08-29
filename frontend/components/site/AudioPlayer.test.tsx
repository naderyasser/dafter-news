import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AudioPlayer from "./AudioPlayer";

describe("AudioPlayer simulated playback speed", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies a speed change immediately to the already-running simulated timer", () => {
    const { container } = render(<AudioPlayer lang="ar" audioSrc={null} durationSeconds={100} />);
    const fillWidth = () => parseFloat(container.querySelector<HTMLElement>(".bg-brand.rounded-pill")!.style.width);

    fireEvent.click(screen.getByLabelText("تشغيل"));

    act(() => {
      vi.advanceTimersByTime(1000); // 4 ticks @ 250ms, speed=1 -> +1%
    });
    const afterFirstBurst = fillWidth();
    expect(afterFirstBurst).toBeCloseTo(1, 5);

    fireEvent.click(screen.getByText("x1"));

    act(() => {
      vi.advanceTimersByTime(1000); // 4 more ticks, now at speed=1.25 -> +1.25%
    });
    const afterSpeedChange = fillWidth();

    // Stale-closure bug: the already-running interval kept computing at the
    // old speed=1 rate, so this burst would advance by the same +1% as the
    // first one. Fixed: it reads the live speed via a ref, so the second
    // burst is measurably faster.
    expect(afterSpeedChange - afterFirstBurst).toBeCloseTo(1.25, 5);
  });
});

/**
 * Regression: a failed play() — a network blip, a browser refusing the
 * codec — left onPlay never firing and nothing else changing, so the button
 * silently did nothing. A reader has no way to tell "this file is broken"
 * from "the feature doesn't exist" without some visible signal.
 */
describe("AudioPlayer playback failure", () => {
  it("shows an error instead of failing silently when play() rejects", async () => {
    const play = vi.fn().mockRejectedValue(new Error("NotSupportedError"));
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play);

    render(<AudioPlayer lang="ar" audioSrc="/media/tts/1.mp3" durationSeconds={100} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("تشغيل"));
      await Promise.resolve();
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر تشغيل الصوت");
  });

  it("shows an error when the audio file itself fails to load", () => {
    render(<AudioPlayer lang="ar" audioSrc="/media/tts/broken.mp3" durationSeconds={100} />);

    fireEvent.error(document.querySelector("audio")!);

    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تشغيل الصوت");
  });

  it("clears a previous error on the next play attempt", async () => {
    const play = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(play);

    render(<AudioPlayer lang="ar" audioSrc="/media/tts/1.mp3" durationSeconds={100} />);
    const button = screen.getByLabelText("تشغيل");

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(button);
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("speaks English on the English edition", () => {
    render(<AudioPlayer lang="en" audioSrc="/media/tts/broken.mp3" durationSeconds={100} />);

    fireEvent.error(document.querySelector("audio")!);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't play the audio");
  });
});

/**
 * Regression: Chromium reports `duration: Infinity` for a freshly-generated
 * MP3 (edge-tts's raw streamed output, no VBR/Xing header) until it has
 * scanned enough of the file — sometimes not at all until a seek forces it.
 * `Infinity` is truthy, so the old plain `||` fallback never caught it: the
 * transport silently adopted an infinite total, and any finite elapsed time
 * divided by Infinity is 0 — the progress bar sat frozen at 0% forever, no
 * matter how much of the narration had actually played. That reads exactly
 * like "the listen feature does nothing", even while audio was genuinely
 * coming out of the speakers the whole time.
 */
describe("AudioPlayer infinite-duration quirk", () => {
  it("still reports real progress when the browser's own duration comes back Infinity", () => {
    const { container } = render(<AudioPlayer lang="ar" audioSrc="/media/tts/1.mp3" durationSeconds={100} />);
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", { value: Infinity, configurable: true });
    Object.defineProperty(audio, "currentTime", { value: 25, configurable: true });

    fireEvent.timeUpdate(audio);

    const fillWidth = parseFloat(container.querySelector<HTMLElement>(".bg-brand.rounded-pill")!.style.width);
    // 25 of the known-good 100s from the server, not stuck at 0%.
    expect(fillWidth).toBeCloseTo(25, 5);
  });

  it("shows the real known duration, not Infinity, when the total time is displayed", () => {
    render(<AudioPlayer lang="ar" audioSrc="/media/tts/1.mp3" durationSeconds={139} />);
    const audio = document.querySelector("audio")!;
    Object.defineProperty(audio, "duration", { value: Infinity, configurable: true });

    fireEvent.timeUpdate(audio);

    expect(screen.getByText("2:19")).toBeInTheDocument();
    expect(screen.queryByText(/Infinity/i)).not.toBeInTheDocument();
  });
});
