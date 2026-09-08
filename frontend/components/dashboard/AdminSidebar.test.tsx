import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AdminSidebar from "./AdminSidebar";

const push = vi.fn();
const refresh = vi.fn();
const logout = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api", () => ({ logout: () => logout() }));

const allowAll = {
  articles: true, media: true, comments: true, taxonomy: true, videos: true, breaking: true,
  ads: true, ticker: true, feeds: true, authors: true, users: true, settings: true,
};

afterEach(() => {
  push.mockReset();
  refresh.mockReset();
  logout.mockReset();
});

describe("AdminSidebar", () => {
  it("names the signed-in account in the footer card", () => {
    render(<AdminSidebar active="overview" permissions={allowAll} user={{ name: "منى سعيد", username: "mona", role: "editor" }} />);

    expect(screen.getByText("منى سعيد")).toBeInTheDocument();
    expect(screen.getByText("محرر")).toBeInTheDocument();
  });

  it("hides the screens the account may not open", () => {
    render(<AdminSidebar active="overview" permissions={{ ...allowAll, users: false, settings: false }} />);

    expect(screen.queryByRole("link", { name: /المستخدمون/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /الإعدادات/ })).toBeNull();
    expect(screen.getByRole("link", { name: /المقالات/ })).toBeInTheDocument();
  });

  it("lists the reels desk beside the video desk, under the same capability", () => {
    render(<AdminSidebar active="overview" permissions={{ ...allowAll, videos: false }} />);

    expect(screen.queryByRole("link", { name: /ريلز/ })).toBeNull();
    render(<AdminSidebar active="overview" permissions={allowAll} />);
    expect(screen.getByRole("link", { name: /ريلز/ })).toHaveAttribute("href", expect.stringMatching(/\/reels$/));
  });

  it("signs out through the API and sends the reader to the login card", async () => {
    logout.mockResolvedValue(undefined);
    render(<AdminSidebar active="overview" permissions={allowAll} />);

    await act(async () => screen.getByRole("button", { name: "تسجيل الخروج" }).click());

    expect(logout).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/login");
    expect(refresh).toHaveBeenCalled();
  });

  it("still leaves when the API call fails — a dead session is not a reason to stay signed in", async () => {
    logout.mockRejectedValue(new Error("boom"));
    render(<AdminSidebar active="overview" permissions={allowAll} />);

    await act(async () => screen.getByRole("button", { name: "تسجيل الخروج" }).click());

    expect(push).toHaveBeenCalledWith("/login");
  });
});
