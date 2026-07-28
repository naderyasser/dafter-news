import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HeroSlider from "./HeroSlider";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const slides = [
  { href: "/article/a", title: "الرئيس يفتتح محور الدلتا", section: "شؤون مصر", time: "منذ ساعة", badge: "breaking" },
  { href: "/article/b", title: "البنك المركزي يثبّت الفائدة", section: "حركة السوق", time: "منذ ساعتين" },
  { href: "/article/c", title: "الأهلي يحسم الصفقة", section: "جوّه الجون", time: "منذ 3 ساعات" },
];

/** matchMedia isn't implemented in jsdom; the component reads it on mount. */
const stubMatchMedia = (reduced: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );

describe("HeroSlider", () => {
  beforeEach(() => stubMatchMedia(false));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows the first slide initially", () => {
    render(<HeroSlider lang="ar" slides={slides} />);

    expect(screen.getByText("الرئيس يفتتح محور الدلتا")).toBeInTheDocument();
    expect(screen.queryByText("الأهلي يحسم الصفقة")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no slides", () => {
    const { container } = render(<HeroSlider lang="ar" slides={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("advances on the next button", async () => {
    const { getByLabelText } = render(<HeroSlider lang="ar" slides={slides} />);

    await act(async () => getByLabelText("التالي").click());

    expect(screen.getByText("البنك المركزي يثبّت الفائدة")).toBeInTheDocument();
  });

  it("wraps backwards from the first slide to the last", async () => {
    const { getByLabelText } = render(<HeroSlider lang="ar" slides={slides} />);

    await act(async () => getByLabelText("السابق").click());

    expect(screen.getByText("الأهلي يحسم الصفقة")).toBeInTheDocument();
  });

  it("jumps to a slide from its dot", async () => {
    const { getByLabelText } = render(<HeroSlider lang="ar" slides={slides} />);

    await act(async () => getByLabelText("شريحة 3").click());

    expect(screen.getByText("الأهلي يحسم الصفقة")).toBeInTheDocument();
  });

  it("auto-advances on a timer", async () => {
    vi.useFakeTimers();
    render(<HeroSlider lang="ar" slides={slides} />);

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(screen.getByText("البنك المركزي يثبّت الفائدة")).toBeInTheDocument();
  });

  it("does not auto-advance under prefers-reduced-motion", async () => {
    stubMatchMedia(true);
    vi.useFakeTimers();
    render(<HeroSlider lang="ar" slides={slides} />);

    await act(async () => {
      vi.advanceTimersByTime(20000);
    });

    expect(screen.getByText("الرئيس يفتتح محور الدلتا")).toBeInTheDocument();
  });

  it("marks the active dot with aria-current", () => {
    const { getByLabelText } = render(<HeroSlider lang="ar" slides={slides} />);

    expect(getByLabelText("شريحة 1")).toHaveAttribute("aria-current", "true");
    expect(getByLabelText("شريحة 2")).toHaveAttribute("aria-current", "false");
  });

  it("renders the breaking badge only on the slide that has one", async () => {
    const { getByLabelText } = render(<HeroSlider lang="ar" slides={slides} />);
    expect(screen.getByText("عاجل")).toBeInTheDocument();

    await act(async () => getByLabelText("التالي").click());

    expect(screen.queryByText("عاجل")).not.toBeInTheDocument();
  });

  it("advances on a swipe toward the inline start", async () => {
    // In RTL the next slide sits on the inline-end (left) side, so the finger
    // travels toward +x to fetch it — the mirror of the LTR gesture.
    const { container } = render(<HeroSlider lang="ar" slides={slides} />);
    const section = container.querySelector("section")!;

    await act(async () => {
      fireEvent.touchStart(section, { touches: [{ clientX: 80 }] });
      fireEvent.touchEnd(section, { changedTouches: [{ clientX: 220 }] });
    });

    expect(screen.getByText("البنك المركزي يثبّت الفائدة")).toBeInTheDocument();
  });

  it("ignores a swipe shorter than the threshold", async () => {
    const { container } = render(<HeroSlider lang="ar" slides={slides} />);
    const section = container.querySelector("section")!;

    await act(async () => {
      fireEvent.touchStart(section, { touches: [{ clientX: 80 }] });
      fireEvent.touchEnd(section, { changedTouches: [{ clientX: 100 }] });
    });

    expect(screen.getByText("الرئيس يفتتح محور الدلتا")).toBeInTheDocument();
  });

  it("sits on the navy field", () => {
    const { container } = render(<HeroSlider lang="ar" slides={slides} />);

    expect(container.firstElementChild?.className).toContain("bg-navy");
  });
});
