import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WelcomeToast from "./WelcomeToast";
import type { WelcomeAlert } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const alert = (over: Partial<WelcomeAlert> = {}): WelcomeAlert => ({
  id: 1,
  active: true,
  kicker: "يحدث الآن",
  title: "تغطية لحظية: مؤتمر البنك المركزي",
  text: "محافظ البنك المركزي يعلن قرار الفائدة خلال دقائق.",
  cta_label: "تابع البث المباشر",
  cta_href: "/live",
  image: null,
  ...over,
});

/** The toast waits 600ms after mount before showing. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(700);
  });
};

/**
 * Dismiss, then let the 200ms leave animation finish.
 *
 * Unlike the modal it replaced, the toast is not blocking anything, so it can
 * animate out instead of vanishing — which means "gone" is a state the test
 * has to wait for rather than assert on the next line.
 */
const dismissAnd = async (click: () => void) => {
  await act(async () => {
    click();
    vi.advanceTimersByTime(300);
  });
};

describe("WelcomeToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("does not show Arabic copy on the English edition", async () => {
    render(<WelcomeToast alert={alert()} lang="en" />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows English copy on the English edition with English chrome", async () => {
    render(<WelcomeToast alert={alert({ kicker: "Welcome", title: "Welcome to Al Daftar News" })} lang="en" />);
    await settle();

    expect(screen.getByText("Welcome to Al Daftar News")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("renders nothing before the delay elapses", () => {
    render(<WelcomeToast alert={alert()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens after the delay", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("تغطية لحظية: مؤتمر البنك المركزي")).toBeInTheDocument();
    expect(screen.getByText("يحدث الآن")).toBeInTheDocument();
  });

  it("stays closed when the alert is switched off", async () => {
    render(<WelcomeToast alert={alert({ active: false })} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays closed when there is no alert at all", async () => {
    render(<WelcomeToast alert={null} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays closed when the alert has no title", async () => {
    render(<WelcomeToast alert={alert({ title: "" })} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes on the dismiss button and remembers it", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    await dismissAnd(() => screen.getByLabelText("إغلاق").click());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("aldaftar:welcome-dismissed")).toBe(alert().title);
  });

  it("closes on «لاحقاً»", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    await dismissAnd(() => screen.getByText("لاحقاً").click());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not reopen for an alert already dismissed this session", async () => {
    sessionStorage.setItem("aldaftar:welcome-dismissed", alert().title);

    render(<WelcomeToast alert={alert()} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("still shows a NEW alert after an older one was dismissed", async () => {
    // Keyed by title on purpose: a session-wide flag would mean the next
    // breaking story never reaches a reader who closed the previous one.
    sessionStorage.setItem("aldaftar:welcome-dismissed", "خبر قديم");

    render(<WelcomeToast alert={alert()} />);
    await settle();

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the CTA pointing at the alert's destination", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    expect(screen.getByText("تابع البث المباشر")).toHaveAttribute("href", "/live");
  });

  it("omits the CTA when no label is configured", async () => {
    render(<WelcomeToast alert={alert({ cta_label: "" })} />);
    await settle();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("never locks page scroll — the whole point of the change", async () => {
    // regression: as a centred modal this set overflow:hidden on <body>, which
    // is what «حتى لا يقطع تجربة تصفح الزائر» was asking us to stop doing.
    render(<WelcomeToast alert={alert()} />);
    await settle();

    expect(document.body.style.overflow).toBe("");
  });

  it("is announced politely, not as a modal that must be answered", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    const toast = screen.getByRole("status");
    expect(toast).not.toHaveAttribute("aria-modal");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(toast).toHaveAttribute("aria-labelledby", "welcome-title");
  });

  it("sits in the corner above the markets ticker, not over the page", async () => {
    render(<WelcomeToast alert={alert()} />);
    await settle();

    const toast = screen.getByRole("status");
    // `start`, not `right`: bottom-right on the RTL edition, mirrored on EN.
    expect(toast.className).toContain("start-5");
    // 68px clears the 52px sticky ticker.
    expect(toast.className).toContain("bottom-[68px]");
    expect(toast.className).not.toMatch(/inset-0/);
  });
});
