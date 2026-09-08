import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_ORIGIN, ApiError, apiMutate, describeApiError, getArticle, getArticles, getLatest, getMostCommented, getMostRead, getSectionMostRead, MOST_COMMENTED_WINDOW_DAYS, SECTION_MOST_READ_WINDOW_DAYS, getSectionFeed, getTicker, mediaUrl } from "./api";

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

  it("ranks most-read by trending score, windowed tight and capped", async () => {
    // The whole «الأكثر قراءة» contract in one URL: sorted by trending_score
    // (views decayed by recency — see ArticleViewSet._trending_annotations
    // on the backend), scoped to a narrow recent window so an old story's
    // large-but-decaying score can't outlast it, and limited.
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getMostRead("ar");

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("ordering=-trending_score");
    // MOST_READ_TRENDING_WINDOW_HOURS (48h) expressed in the whole days
    // `published_within` actually accepts.
    expect(url).toContain("published_within=2");
    expect(url).toContain("page_size=5");
    expect(url).toContain("language=ar");
  });

  it("takes a language and a limit for the standalone most-read page", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getMostRead("en", 10);

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("language=en");
    expect(url).toContain("page_size=10");
  });

  it("keeps most-read on a 30-second window so a climbing story surfaces without a redeploy", async () => {
    // Shorter than the other lists on purpose: this is the one a reader's
    // own actions change, so it has to visibly answer them while the
    // newsroom is testing.
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getMostRead("ar");

    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ next: { revalidate: 30 } });
  });

  it("orders a section block strictly newest-first", async () => {
    // regression: the ordering led with `-pinned`, so «الظهور في الرئيسية»
    // held the top of a section's own block indefinitely — «الخليج العربي»
    // showed a 22-hour-old pinned story above one published an hour before,
    // and the front looked frozen for days.
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getSectionFeed("ar", "gulf", 6);

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("ordering=-published_at");
    expect(url).not.toContain("pinned");
    expect(url).toContain("section__key=gulf");
    expect(url).toContain("page_size=6");
  });

  it("ranks the section rail by the same trending score as the site-wide list, scoped to the desk", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getSectionMostRead("ar", "pol");

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("ordering=-trending_score");
    expect(url).toContain("section__key=pol");
    expect(url).toContain(`published_within=${SECTION_MOST_READ_WINDOW_DAYS}`);
  });

  it("gives the section rail a wider window than the site-wide list — one desk does not fill five rows in 48 hours", async () => {
    // Measured on the live database: at 48 hours «سياسة» had two entries and
    // «ملف خاص» none, so the desk-scoped rail would have fallen back to the
    // site-wide list on nearly every section.
    expect(SECTION_MOST_READ_WINDOW_DAYS).toBeGreaterThan(2);
  });

  it("encodes a section key on the rail too", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getSectionMostRead("ar", "a b&c");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(encodeURIComponent("a b&c"));
  });

  it("encodes a section key rather than pasting it into the URL", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getSectionFeed("ar", "a b&c");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(encodeURIComponent("a b&c"));
  });

  it("fetches «الأحدث» strictly newest-first", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getLatest("ar", 12);

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("ordering=-published_at");
    expect(url).toContain("page_size=12");
    // No recency window here on purpose: this list IS the recency ordering,
    // so bounding it would only hide the tail on a quiet news day.
    expect(url).not.toContain("published_within");
  });

  it("windows «الأكثر تعليقاً», on its own horizon rather than most-read's", async () => {
    // regression: comment counts only accumulate, so unbounded this tab was
    // an all-time leaderboard held by the seeded demo articles — it showed
    // three-week-old copy right beside the «الأحدث» tab showing today's.
    //
    // The window is 30 days, not the 7 this borrowed from «الأكثر قراءة».
    // Reads arrive in thousands a day and comments in ones, so seven days
    // left the tab with nothing to rank on most days — and retiring the demo
    // import, the second job those seven days were doing badly, is now done
    // directly by counting approved comments only.
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getMostCommented("ar");

    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("ordering=-comment_count");
    expect(url).toContain(`published_within=${MOST_COMMENTED_WINDOW_DAYS}`);
  });

  it("asks «الأكثر تعليقاً» for stories that actually have comments", async () => {
    // The newsroom reported this tab as showing the latest news, i.e. as
    // being wired to the «الأحدث» tab's query. It never was: ranked by
    // -comment_count alone, nearly every story ties at zero, and the
    // backend's StableOrderingFilter breaks that tie on -published_at — so
    // the tab returned the newest stories. Filtering the pool is the fix.
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getMostCommented("ar");

    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("has_comments=true");
  });

  it("keeps both «أحدث الأخبار» tabs on the same 60-second freshness", async () => {
    vi.mocked(fetch).mockReturnValue(okJson({ count: 0, next: null, previous: null, results: [] }));

    await getLatest("ar");
    await getMostCommented("ar");

    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ next: { revalidate: 60 } });
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ next: { revalidate: 60 } });
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

  it("carries the response body on the rejection so the caller can explain the failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: () => Promise.resolve({ title: ["This field may not be blank."] }),
    } as unknown as Response);

    await expect(apiMutate("/articles/", "POST", {})).rejects.toMatchObject({
      body: { title: ["This field may not be blank."] },
    });
  });
});

describe("describeApiError", () => {
  it("translates a DRF field-error body into a readable line", () => {
    const err = new ApiError("/articles/", 400, "Bad Request", { title: ["This field may not be blank."] });

    expect(describeApiError(err, "fallback")).toBe("العنوان: This field may not be blank.");
  });

  it("joins multiple field errors and messages", () => {
    const err = new ApiError("/articles/", 400, "Bad Request", {
      title: ["Required."],
      section: ["Invalid pk.", "Must not be null."],
    });

    expect(describeApiError(err, "fallback")).toBe("العنوان: Required. — القسم: Invalid pk.، Must not be null.");
  });

  it("falls back for a network failure with no response body", () => {
    expect(describeApiError(new Error("offline"), "تعذّر الاتصال")).toBe("تعذّر الاتصال");
  });

  it("falls back when the response wasn't JSON", () => {
    const err = new ApiError("/articles/", 502, "Bad Gateway", null);

    expect(describeApiError(err, "تعذّر الاتصال")).toBe("تعذّر الاتصال");
  });
});
