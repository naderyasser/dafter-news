import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ORIGIN, apiMutate, getArticle, getArticles, getTicker, mediaUrl } from "./api";

const okJson = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);

describe("mediaUrl", () => {
  it("returns undefined for a missing path", () => {
    expect(mediaUrl(null)).toBeUndefined();
    expect(mediaUrl(undefined)).toBeUndefined();
    expect(mediaUrl("")).toBeUndefined();
  });

  it("prefixes a Django MEDIA_URL path with the API origin", () => {
    expect(mediaUrl("/media/covers/x.jpg")).toBe(`${API_ORIGIN}/media/covers/x.jpg`);
  });

  it("leaves an absolute URL untouched", () => {
    expect(mediaUrl("https://cdn.example.com/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(mediaUrl("http://localhost:8000/media/a.jpg")).toBe("http://localhost:8000/media/a.jpg");
  });
});

describe("read helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests the articles list and returns its page", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 1, next: null, previous: null, results: [{ id: 1 }] }));

    const page = await getArticles("?page_size=5");

    expect(page.count).toBe(1);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/articles/?page_size=5");
  });

  it("returns an empty page instead of throwing when the API is down", async () => {
    // The public pages must degrade to an empty state, not a 500 — this is
    // deliberate, and it is why page checks assert on content not status.
    vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

    const page = await getArticles();

    expect(page.results).toEqual([]);
    expect(page.count).toBe(0);
  });

  it("returns an empty page on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" } as Response);

    await expect(getArticles()).resolves.toEqual({ count: 0, next: null, previous: null, results: [] });
  });

  it("returns null for a missing article rather than throwing", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" } as Response);

    await expect(getArticle("nope")).resolves.toBeNull();
  });

  it("encodes an Arabic slug exactly once", async () => {
    // regression: params arrive percent-encoded and were forwarded as-is,
    // producing a double-encoded URL the API could never match.
    vi.mocked(fetch).mockReturnValue(okJson({ id: 1 }));

    await getArticle("الذهب");

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain(encodeURIComponent("الذهب"));
    expect(url).not.toContain("%25"); // no double-encoding
  });

  it("normalises an already-encoded slug to a single encoding", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ id: 1 }));

    await getArticle(encodeURIComponent("الذهب"));

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain(encodeURIComponent("الذهب"));
    expect(url).not.toContain("%25");
  });

  it("falls back to an empty ticker payload when the API is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));

    const ticker = await getTicker();

    expect(ticker.currencies).toEqual([]);
    expect(ticker.weather).toBeNull();
  });
});

/** The mutation is whichever fetch was not the /auth/csrf/ bootstrap. */
function mutationCall() {
  const calls = vi.mocked(fetch).mock.calls;
  return calls.find(([url]) => !String(url).includes("/auth/csrf/")) ?? calls[0];
}

describe("apiMutate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // apiMutate fetches /auth/csrf/ first when the browser has no csrftoken
    // cookie yet, so the mutation is not necessarily call 0.
    vi.stubGlobal("document", { cookie: "csrftoken=test-token" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the method and a JSON body", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ id: 7, status: "published" }));

    const result = await apiMutate<{ id: number }>("/articles/7/", "PATCH", { status: "published" });

    expect(result.id).toBe(7);
    const [, init] = mutationCall();
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ status: "published" }));
    expect((init?.headers as Record<string, string>)["X-CSRFToken"]).toBe("test-token");
  });

  it("omits the body when none is given", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);

    await apiMutate("/articles/7/", "DELETE");

    const [, init] = mutationCall();
    expect(init?.body).toBeUndefined();
  });

  it("propagates failures so callers can react", async () => {
    // Unlike reads, a failed write must not be swallowed into a fake success.
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 400, statusText: "Bad Request" } as Response);

    await expect(apiMutate("/articles/", "POST", {})).rejects.toThrow();
  });
});
