import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UrgentNotification from "./UrgentNotification";
import type { UrgentNotification as UrgentNotificationData } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: any) => <img src={typeof src === "string" ? src : ""} alt={alt} {...rest} />,
}));

const notification = (over: Partial<UrgentNotificationData> = {}): UrgentNotificationData => ({
  id: 12,
  title: "زلزال يضرب المنطقة",
  label: "خبر عاجل",
  href: "/article/earthquake",
  cover_image: null,
  published_at: "2026-08-12T10:00:00Z",
  ...over,
});

/** The popup waits 400ms after mount before showing. */
const settle = async () => {
  await act(async () => {
    vi.advanceTimersByTime(500);
  });
};

const dismissAnd = async (click: () => void) => {
  await act(async () => {
    click();
    vi.advanceTimersByTime(300);
  });
};

describe("UrgentNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing before the delay elapses", () => {
    render(<UrgentNotification notification={notification()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens after the delay with the label and title", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("زلزال يضرب المنطقة")).toBeInTheDocument();
    expect(screen.getByText("خبر عاجل")).toBeInTheDocument();
  });

  it("stays closed when there is nothing active", async () => {
    render(<UrgentNotification notification={null} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays closed for an empty {} response — no id, nothing to show", async () => {
    render(<UrgentNotification notification={{}} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("the whole card is one link to the article, not just a button inside it", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/article/earthquake");
    expect(link).toHaveTextContent("زلزال يضرب المنطقة");
    expect(link).toHaveTextContent("خبر عاجل");
  });

  it("closes on the × button without following the link", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    await dismissAnd(() => screen.getByLabelText("إغلاق الإشعار").click());

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("remembers the dismissal in localStorage, keyed by id — persists across visits", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    await dismissAnd(() => screen.getByLabelText("إغلاق الإشعار").click());

    expect(localStorage.getItem("aldaftar:urgent-dismissed")).toBe("12");
  });

  it("does not reopen an already-dismissed notification", async () => {
    localStorage.setItem("aldaftar:urgent-dismissed", "12");

    render(<UrgentNotification notification={notification()} />);
    await settle();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("a fresher urgent article (a new id) shows even if the old one was dismissed", async () => {
    localStorage.setItem("aldaftar:urgent-dismissed", "12");

    render(<UrgentNotification notification={notification({ id: 13, title: "خبر أحدث" })} />);
    await settle();

    expect(screen.getByText("خبر أحدث")).toBeInTheDocument();
  });

  it("is announced politely, not as a modal that must be answered", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    const box = screen.getByRole("status");
    expect(box).not.toHaveAttribute("aria-modal");
    expect(box).toHaveAttribute("aria-live", "polite");
  });

  it("sits at the opposite corner from WelcomeToast, above the sticky ticker", async () => {
    render(<UrgentNotification notification={notification()} />);
    await settle();

    const box = screen.getByRole("status");
    // WelcomeToast takes `start`; this box takes `end` so the two can coexist.
    expect(box.className).toContain("end-5");
    expect(box.className).not.toContain("start-5");
    // 68px clears the 52px sticky ticker, same reserve WelcomeToast uses.
    expect(box.className).toContain("bottom-[68px]");
  });
});
