import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SectionHeading from "./SectionHeading";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("SectionHeading", () => {
  it("links the nameplate to the desk", () => {
    render(<SectionHeading lang="ar" title="ثقافة وفن" href="/section/art" sectionKey="art" />);

    expect(screen.getByRole("link", { name: "ثقافة وفن" })).toHaveAttribute("href", "/section/art");
  });

  it("carries no «المزيد» unless asked — list blocks keep theirs at the foot", () => {
    render(<SectionHeading lang="ar" title="أمن ومحاكم" href="/section/security" />);

    expect(screen.queryByRole("link", { name: /المزيد/ })).not.toBeInTheDocument();
  });

  it("adds a header-level «المزيد» link for a carousel — regression: «ثقافة وفن» had no way to the desk", () => {
    render(<SectionHeading lang="ar" title="ثقافة وفن" href="/section/art" moreHref="/section/art" />);

    expect(screen.getByRole("link", { name: /المزيد/ })).toHaveAttribute("href", "/section/art");
  });

  it("says More in English", () => {
    render(<SectionHeading lang="en" title="Culture" moreHref="/en/section/art" />);

    expect(screen.getByRole("link", { name: /More/ })).toBeInTheDocument();
  });

  it("renders the caller's controls on the nameplate row", () => {
    render(<SectionHeading lang="ar" title="مقالات" actions={<button type="button">التالي</button>} />);

    expect(screen.getByRole("button", { name: "التالي" })).toBeInTheDocument();
  });
});
