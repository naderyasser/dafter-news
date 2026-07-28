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
