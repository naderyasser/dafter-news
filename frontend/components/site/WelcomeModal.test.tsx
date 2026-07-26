import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WelcomeModal from "./WelcomeModal";
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

/** The modal waits 600ms after mount before showing. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(700);
  });
};

describe("WelcomeModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = "";
  });

  it("renders nothing before the delay elapses", () => {
    render(<WelcomeModal alert={alert()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens after the delay", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("تغطية لحظية: مؤتمر البنك المركزي")).toBeInTheDocument();
    expect(screen.getByText("يحدث الآن")).toBeInTheDocument();
  });

  it("stays closed when the alert is switched off", async () => {
    render(<WelcomeModal alert={alert({ active: false })} />);
    await settle();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed when there is no alert at all", async () => {
    render(<WelcomeModal alert={null} />);
    await settle();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays closed when the alert has no title", async () => {
    render(<WelcomeModal alert={alert({ title: "" })} />);
    await settle();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on the dismiss button and remembers it", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();

    await act(async () => screen.getByLabelText("إغلاق").click());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("aldaftar:welcome-dismissed")).toBe(alert().title);
  });

  it("closes on «لاحقاً»", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();

    await act(async () => screen.getByText("لاحقاً").click());

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not reopen for an alert already dismissed this session", async () => {
    sessionStorage.setItem("aldaftar:welcome-dismissed", alert().title);

    render(<WelcomeModal alert={alert()} />);
    await settle();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("still shows a NEW alert after an older one was dismissed", async () => {
    // Keyed by title on purpose: a session-wide flag would mean the next
    // breaking story never reaches a reader who closed the previous one.
    sessionStorage.setItem("aldaftar:welcome-dismissed", "خبر قديم");

    render(<WelcomeModal alert={alert()} />);
    await settle();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the CTA pointing at the alert's destination", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();

    expect(screen.getByText("تابع البث المباشر")).toHaveAttribute("href", "/live");
  });

  it("omits the CTA when no label is configured", async () => {
    render(<WelcomeModal alert={alert({ cta_label: "" })} />);
    await settle();

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("locks page scroll while open and restores it on close", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();
    expect(document.body.style.overflow).toBe("hidden");

    await act(async () => screen.getByLabelText("إغلاق").click());

    expect(document.body.style.overflow).toBe("");
  });

  it("is announced as a modal dialog", async () => {
    render(<WelcomeModal alert={alert()} />);
    await settle();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "welcome-title");
  });
});
