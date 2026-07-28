import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import NavDrawer from "./NavDrawer";
import { SECTION_IDENTITY } from "@/lib/sections";
import type { Section } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const sections: Section[] = [
  { id: 1, key: "egypt", name_ar: "شؤون مصر", name_en: "Egypt", order: 1, article_count: 0 },
  { id: 2, key: "sports", name_ar: "جوّه الجون", name_en: "Sports", order: 2, article_count: 0 },
];
const extras = [{ label: "الأسواق", href: "/markets" }];

const openDrawer = () => fireEvent.click(screen.getByLabelText("الأقسام"));

describe("NavDrawer", () => {
  afterEach(() => {
    document.body.style.overflow = "";
    push.mockClear();
  });

  it("opens from the hamburger and closes on Escape", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);

    openDrawer();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives every section row its own section colour", () => {
    // The same value the section's heading rule and card kickers use — the
    // drawer teaches the colour system rather than inventing its own.
    // The panel portals to <body> (so `fixed` can't be captured by the
    // sticky masthead), so the assertion reads from there.
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);
    openDrawer();

    const html = document.body.innerHTML;
    const toRgb = (hex: string) =>
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
    expect(html).toContain(toRgb(SECTION_IDENTITY.egypt.color));
    expect(html).toContain(toRgb(SECTION_IDENTITY.sports.color));
  });

  it("marks the section the reader is already in", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} active="sports" />);
    openDrawer();

    expect(screen.getByText("جوّه الجون").closest("a")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("شؤون مصر").closest("a")).not.toHaveAttribute("aria-current");
  });

  it("hands a search off to /search and closes", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);
    openDrawer();

    fireEvent.change(screen.getByLabelText("ابحث في الموقع"), { target: { value: "الدلتا" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent("الدلتا")}`);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("prefixes /en on the English edition's search", () => {
    render(<NavDrawer lang="en" sections={sections} extraLinks={[]} />);
    fireEvent.click(screen.getByLabelText("Sections"));

    fireEvent.change(screen.getByLabelText("Search the site"), { target: { value: "delta" } });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith("/en/search?q=delta");
  });

  it("does not navigate on an empty query", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);
    openDrawer();

    fireEvent.submit(screen.getByRole("search"));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("locks page scroll while open and restores it on close", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);
    openDrawer();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByLabelText("إغلاق"));
    expect(document.body.style.overflow).toBe("");
  });

  it("labels the quick-links block so it reads as a different kind of destination", () => {
    render(<NavDrawer lang="ar" sections={sections} extraLinks={extras} />);
    openDrawer();

    expect(screen.getByText("روابط سريعة")).toBeInTheDocument();
    expect(screen.getByText("الأسواق")).toBeInTheDocument();
  });

  it("traps Tab within the drawer instead of leaking focus into the page behind it", () => {
    render(
      <>
        <a href="/before" data-testid="page-link">
          page link before the drawer
        </a>
        <NavDrawer lang="ar" sections={sections} extraLinks={extras} />
      </>,
    );
    openDrawer();

    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Tab forward from the last focusable row must wrap back to the first,
    // never fall through to page content sitting behind the overlay.
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(first);

    // Shift+Tab back from the first row must wrap to the last, not escape.
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    expect(document.activeElement).not.toBe(screen.getByTestId("page-link"));
  });
});
