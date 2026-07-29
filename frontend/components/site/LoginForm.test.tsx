import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginForm, { safeNext } from "./LoginForm";

/** What lib/api actually throws: an Error carrying the HTTP status. */
const apiError = (status: number, path = "/auth/login/", statusText = "Unauthorized") =>
  Object.assign(new Error(`API ${path} failed: ${status} ${statusText}`), { status });

const push = vi.fn();
const refresh = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => search,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const login = vi.fn();
const register = vi.fn();
vi.mock("@/lib/api", () => ({
  login: (...args: unknown[]) => login(...args),
  register: (...args: unknown[]) => register(...args),
}));

const fill = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submitLogin = async (user = "m.eladawy", pass = "hunter2") => {
  fill(/البريد الإلكتروني أو اسم المستخدم/, user);
  fill("كلمة المرور", pass);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "دخول" }));
  });
};

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/dashboard", "/dashboard"],
    ["/section/egypt?page=2", "/section/egypt?page=2"],
    ["/article/x#comments", "/article/x#comments"],
    // A path that merely *mentions* a host is still a path.
    ["/redirect?to=https://evil.example", "/redirect?to=https://evil.example"],
  ])("passes the same-site path %s through", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "http://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\\\\evil.example",
    "/%5Cevil.example",
    "/%5cevil.example",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "  https://evil.example",
    // Browsers strip these from a URL before parsing, so "/\t/evil.example"
    // reaches the network as "//evil.example".
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "evil.example",
    "../../etc/passwd",
  ])("sends %j to the front page instead", (input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("treats a missing value as the front page", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });
});

describe("LoginForm", () => {
  beforeEach(() => {
    search = new URLSearchParams();
    login.mockReset();
    register.mockReset();
    push.mockReset();
    refresh.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("sends staff to the newsroom", async () => {
    login.mockResolvedValue({ is_staff_member: true });
    render(<LoginForm />);
    await submitLogin();

    expect(login).toHaveBeenCalledWith("m.eladawy", "hunter2");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("sends a reader to the front page, not the newsroom", async () => {
    login.mockResolvedValue({ is_staff_member: false });
    render(<LoginForm />);
    await submitLogin();

    expect(push).toHaveBeenCalledWith("/");
    expect(push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("returns the reader to the page that sent them to sign in", async () => {
    search = new URLSearchParams("next=/dashboard/articles");
    login.mockResolvedValue({ is_staff_member: true });
    render(<LoginForm />);
    await submitLogin();

    expect(push).toHaveBeenCalledWith("/dashboard/articles");
  });

  /**
   * `next` is attacker-controlled: it arrives in the query string of a link
   * anyone can send. Handing it to router.push() unchecked turns the real
   * sign-in page into the first hop of a phishing chain — the reader types
   * their password on the genuine site, sees it succeed, and lands on a
   * lookalike that asks them to "confirm" it.
   */
  it.each([
    ["an absolute URL", "https://evil.example/login"],
    ["a protocol-relative URL", "//evil.example/login"],
    ["a backslash-smuggled URL", "/\\evil.example"],
    ["a javascript: URL", "javascript:alert(document.cookie)"],
    ["a scheme with mixed case", "HtTps://evil.example"],
    ["a whitespace-padded URL", "  https://evil.example"],
  ])("refuses to redirect off-site through %s", async (_label, target) => {
    search = new URLSearchParams([["next", target]]);
    login.mockResolvedValue({ is_staff_member: false });
    render(<LoginForm />);
    await submitLogin();

    const dest = push.mock.calls[0]?.[0] as string;
    expect(dest).toBe("/");
  });

  it("names the failure a reader can act on when the password is wrong", async () => {
    login.mockRejectedValue(apiError(401));
    render(<LoginForm />);
    await submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
    expect(push).not.toHaveBeenCalled();
  });

  it("falls back to a generic message on a server fault", async () => {
    login.mockRejectedValue(apiError(500, "/auth/login/", "Internal Server Error"));
    render(<LoginForm />);
    await submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر تسجيل الدخول. حاول مرة أخرى.");
  });

  it("does not read a 401 out of an unrelated path or body", async () => {
    // The old check was `message.includes("401")`, which a path or a echoed
    // field value could satisfy on its own — telling a reader their password
    // was wrong when the server had actually fallen over.
    login.mockRejectedValue(apiError(503, "/auth/login/?ref=401", "Service Unavailable"));
    render(<LoginForm />);
    await submitLogin();

    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر تسجيل الدخول. حاول مرة أخرى.");
  });

  it("never leaves a stale error under a fresh attempt", async () => {
    login.mockRejectedValueOnce(apiError(401));
    login.mockResolvedValueOnce({ is_staff_member: false });
    render(<LoginForm />);

    await submitLogin();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await submitLogin();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("clears the error when the reader switches to registering", async () => {
    login.mockRejectedValue(apiError(401));
    render(<LoginForm />);
    await submitLogin();
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "إنشاء حساب جديد" }));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("registers with a name and reports registration failures in its own words", async () => {
    register.mockRejectedValue(apiError(400, "/auth/register/", "Bad Request"));
    render(<LoginForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "إنشاء حساب جديد" }));
    });

    fill("الاسم", "منى");
    fill("البريد الإلكتروني", "mona@example.com");
    fill("كلمة المرور", "hunter2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "إنشاء الحساب" }));
    });

    expect(register).toHaveBeenCalledWith("mona@example.com", "hunter2", "منى");
    expect(await screen.findByRole("alert")).toHaveTextContent("تعذّر إنشاء الحساب");
  });

  it("keeps the password masked until the reader asks to see it", async () => {
    render(<LoginForm />);
    const field = screen.getByLabelText("كلمة المرور");

    expect(field).toHaveAttribute("type", "password");
    await act(async () => {
      fireEvent.click(screen.getByLabelText("إظهار كلمة المرور"));
    });
    expect(field).toHaveAttribute("type", "text");
  });

  it("accepts a username, not just an email, when signing in", () => {
    render(<LoginForm />);

    // type="email" made the browser refuse a valid newsroom login.
    expect(screen.getByLabelText(/البريد الإلكتروني أو اسم المستخدم/)).toHaveAttribute("type", "text");
  });

  it("blocks a second submit while the first is in flight", async () => {
    let release: (v: unknown) => void = () => {};
    login.mockReturnValue(new Promise((r) => (release = r)));
    render(<LoginForm />);

    fill(/البريد الإلكتروني أو اسم المستخدم/, "m.eladawy");
    fill("كلمة المرور", "hunter2");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "دخول" }));
    });

    expect(screen.getByRole("button", { name: "لحظة…" })).toBeDisabled();
    await act(async () => {
      release({ is_staff_member: false });
    });
  });
});
