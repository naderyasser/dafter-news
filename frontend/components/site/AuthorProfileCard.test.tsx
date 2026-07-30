import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuthorProfileCard from "./AuthorProfileCard";
import type { Author } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const author: Author = {
  id: 7,
  username: "m.eladawy",
  name: "محمد العدوي",
  name_en: "Mohamed El-Adawy",
  initial: "م",
  bio: "صحفي استقصائي",
  title: "رئيس قسم التحقيقات",
  avatar: null,
  is_hidden: false,
  article_count: 12,
  opinion_count: 0,
  date_joined: "2024-01-01T00:00:00Z",
};

/**
 * The credibility block under a signed piece — opinion columns always had
 * it, «ملف خاص» investigations now share it. One component, so the two can
 * never drift apart.
 */
describe("AuthorProfileCard", () => {
  it("shows the name and the professional title", () => {
    render(<AuthorProfileCard lang="ar" author={author} />);

    expect(screen.getByText("محمد العدوي")).toBeInTheDocument();
    expect(screen.getByText("رئيس قسم التحقيقات")).toBeInTheDocument();
  });

  it("falls back to the bio when there is no title", () => {
    render(<AuthorProfileCard lang="ar" author={{ ...author, title: "" }} />);

    expect(screen.getByText("صحفي استقصائي")).toBeInTheDocument();
  });

  it("falls back to the initial when there is no photo", () => {
    render(<AuthorProfileCard lang="ar" author={author} />);

    expect(screen.getByText("م")).toBeInTheDocument();
  });

  it("renders the photo when one exists", () => {
    render(<AuthorProfileCard lang="ar" author={{ ...author, avatar: "/media/avatars/adawy.png" }} />);

    expect(screen.getByAltText("محمد العدوي")).toBeInTheDocument();
  });

  it("links to the author's page", () => {
    render(<AuthorProfileCard lang="ar" author={author} />);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/authors/m.eladawy");
  });

  it("uses the romanised byline on the English edition", () => {
    render(<AuthorProfileCard lang="en" author={author} />);

    expect(screen.getByText("Mohamed El-Adawy")).toBeInTheDocument();
  });
});
