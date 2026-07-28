import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PageSkeleton from "./PageSkeleton";

describe("PageSkeleton", () => {
  it.each(["home", "article", "list"] as const)("renders the %s variant without crashing", (variant) => {
    const { container } = render(<PageSkeleton lang="ar" variant={variant} />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("is hidden from assistive tech — it's a placeholder, not content", () => {
    const { container } = render(<PageSkeleton lang="en" variant="home" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
