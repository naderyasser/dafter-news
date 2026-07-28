import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TaxonomyManager from "./TaxonomyManager";
import type { Section, Tag } from "@/lib/types";

const dashMutate = vi.fn();
vi.mock("@/lib/api", () => ({ dashMutate: (...args: unknown[]) => dashMutate(...args) }));

const sections: Section[] = [{ id: 1, key: "gulf", name_ar: "الخليج", name_en: "Gulf", order: 1, article_count: 0 }];
const tags: Tag[] = [{ id: 1, name: "انتخابات", slug: "elections" }];

describe("TaxonomyManager removeTag", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    dashMutate.mockReset();
  });

  it("asks for confirmation before deleting a tag, same as removeSection", () => {
    vi.mocked(confirm).mockReturnValue(false);
    render(<TaxonomyManager sections={sections} tags={tags} />);

    fireEvent.click(screen.getByLabelText("حذف انتخابات"));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("انتخابات"));
    expect(dashMutate).not.toHaveBeenCalled();
    expect(screen.getByText("انتخابات")).toBeInTheDocument();
  });

  it("removes the tag once confirmed and the server accepts the delete", async () => {
    dashMutate.mockResolvedValue(undefined);
    render(<TaxonomyManager sections={sections} tags={tags} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("حذف انتخابات"));
    });

    expect(confirm).toHaveBeenCalled();
    expect(screen.queryByText("انتخابات")).not.toBeInTheDocument();
  });
});
