import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import StickyHeader from "./StickyHeader";

const setScrollY = (y: number) => {
  Object.defineProperty(window, "scrollY", { value: y, writable: true, configurable: true });
};

const scrollTo = async (y: number) => {
  setScrollY(y);
  await act(async () => {
    fireEvent.scroll(window);
    await new Promise((r) => requestAnimationFrame(r));
  });
};

describe("StickyHeader", () => {
  it("starts visible", () => {
    render(
      <StickyHeader>
        <span>masthead</span>
      </StickyHeader>,
    );

    expect(screen.getByText("masthead").parentElement).toHaveClass("translate-y-0");
  });

  it("ignores small scrolling near the top — no flicker while a reader is still basically there", async () => {
    render(
      <StickyHeader>
        <span>masthead</span>
      </StickyHeader>,
    );

    await scrollTo(40);

    expect(screen.getByText("masthead").parentElement).toHaveClass("translate-y-0");
  });

  it("hides once the reader scrolls down past the threshold", async () => {
    render(
      <StickyHeader>
        <span>masthead</span>
      </StickyHeader>,
    );

    await scrollTo(400);

    expect(screen.getByText("masthead").parentElement).toHaveClass("-translate-y-full");
  });

  it("reappears as soon as the reader scrolls back up", async () => {
    render(
      <StickyHeader>
        <span>masthead</span>
      </StickyHeader>,
    );

    await scrollTo(400);
    await scrollTo(350);

    expect(screen.getByText("masthead").parentElement).toHaveClass("translate-y-0");
  });
});
