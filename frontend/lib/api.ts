import { decodeParam } from "./format";
import type {
  AdPlacement,
  ArticleCard,
  ArticleDetail,
  Author,
  BreakingNewsItem,
  Comment,
  DashboardOverview,
  DashUser,
  MediaAsset,
  Match,
  PrayerTimes,
  Story,
  SyncLog,
  WelcomeAlert,
  WireArticle,
  Paginated,
  Section,
  SiteSettings,
  Tag,
  TickerModule,
  TickerPayload,
  UrgentNotification,
  Video,
  VideoDetail,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

/** Resolve a Django MEDIA_URL-relative path (or absolute URL) to a full URL. */
export function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

/**
 * Thrown by apiFetch/apiUpload on a non-2xx response, carrying the parsed
 * JSON body (DRF validation errors, `{"detail": "..."}`, etc.) when the
 * response was JSON. A bare "failed: 400" told an editor nothing about
 * *what* to fix; this gives describeApiError() something to read instead of
 * a caller having to guess from a status code alone.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(path: string, status: number, statusText: string, body: unknown) {
    super(`API ${path} failed: ${status} ${statusText}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function readErrorBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    // Not a JSON body (a bare 502 from nginx, an empty 500) — the caller
    // falls back to its own generic message.
    return null;
  }
}

const DRF_FIELD_LABELS_AR: Record<string, string> = {
  title: "العنوان",
  slug: "الرابط الدائم",
  section: "القسم",
  standfirst: "المقدمة",
  blocks: "المحتوى",
  tag_names: "الوسوم",
  cover_image: "صورة الغلاف",
  cover_asset_id: "صورة الغلاف",
  language: "اللغة",
  status: "الحالة",
  username: "اسم المستخدم",
  email: "البريد الإلكتروني",
  text: "النص",
  non_field_errors: "بيانات الخبر",
  detail: "",
  // The driver's own constraint message, attached to a 409 for staff callers
  // (see aldaftar/exceptions.py). Unlabelled: it follows `detail`, which has
  // already said what happened in Arabic, and prefixing a Postgres constraint
  // name with a field label would only imply it names a form field.
  db_detail: "",
};

/**
 * Turn a caught error into one line an editor can act on — which field DRF
 * rejected and why — instead of a generic "تعذّر الحفظ". Falls back to
 * `fallback` for network failures or bodies that aren't DRF's usual
 * {field: [messages]} shape.
 */
export function describeApiError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return fallback;
  const body = err.body as Record<string, unknown>;
  const parts: string[] = [];
  for (const [field, messages] of Object.entries(body)) {
    const label = DRF_FIELD_LABELS_AR[field] ?? field;
    const text = Array.isArray(messages) ? messages.join("، ") : String(messages);
    if (!text) continue;
    parts.push(label ? `${label}: ${text}` : text);
  }
  return parts.length ? parts.join(" — ") : fallback;
}

type FetchOptions = RequestInit & { revalidate?: number };

/**
 * Dashboard reads must never come from cache: an editor who saves a change
 * and reloads has to see it. Public pages keep their own TTLs.
 */
export const FRESH: FetchOptions = { revalidate: 0 };

/**
 * Forward the caller's session cookie on server-rendered requests.
 *
 * Dashboard pages are Server Components: their fetches leave the Next process,
 * not the browser, so they carry no cookie of their own. Now that the API is
 * staff-gated they would all come back 403 and the screens would render empty.
 * `next/headers` is server-only, so it is imported lazily — reaching for it in
 * a client component would break the bundle.
 *
 * Only called for `revalidate: 0` (FRESH) requests — see apiFetch. Calling
 * `next/headers()` AT ALL, even just to check for a cookie, marks the whole
 * route as dynamic in the App Router: every public page (home, section,
 * article, tag…) was calling this unconditionally on every fetch and losing
 * ISR entirely as a result, with every visitor's request re-running the
 * page's full fetch chain against Django from scratch — the `revalidate`
 * windows below were silently doing nothing. Public reads never needed the
 * cookie in the first place: the article page's own notFound() recheck for
 * `status !== "published"` already treats a staff session leaking a draft
 * through here as a bug to guard against, not a feature this enabled.
 */
async function serverCookieHeader(): Promise<Record<string, string>> {
  if (typeof window !== "undefined") return {};
  try {
    const { headers } = await import("next/headers");
    const cookie = headers().get("cookie");
    return cookie ? { cookie } : {};
  } catch {
    // Outside a request scope (build-time prerender) there is no caller to
    // impersonate; the request goes out anonymous, which is correct.
    return {};
  }
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;
  const forwarded = revalidate === 0 ? await serverCookieHeader() : {};
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // Same-origin behind nginx, so the browser attaches the session cookie by
    // default; this makes it explicit and survives a split-origin deployment.
    credentials: "include",
    headers: { "Content-Type": "application/json", ...forwarded, ...(init.headers || {}) },
    // Public pages read fresh-ish data; dashboard mutations opt out via revalidate:0/no-store.
    next: revalidate !== undefined ? { revalidate } : { revalidate: 60 },
    cache: revalidate === 0 ? "no-store" : undefined,
  });
  if (!res.ok) {
    throw new ApiError(path, res.status, res.statusText, await readErrorBody(res));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** GETs return a safe fallback instead of throwing, so a down/empty backend
 * renders an empty state rather than crashing the page. */
async function safeGet<T>(path: string, fallback: T, options?: FetchOptions): Promise<T> {
  try {
    return await apiFetch<T>(path, options);
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------ public reads
export const getArticles = (query = "", opts?: FetchOptions) =>
  safeGet<Paginated<ArticleCard>>(`/articles/${query}`, { count: 0, next: null, previous: null, results: [] }, opts);

/** Slugs may be Arabic (see Article.save()). Route params arrive
 * percent-encoded — and re-encoded again by middleware — so decode fully
 * before re-encoding once, instead of forwarding a double-encoded slug
 * the API would never match. */
const encodeSlug = (slug: string) => encodeURIComponent(decodeParam(slug));

export const getArticle = (slug: string) =>
  safeGet<ArticleDetail | null>(`/articles/${encodeSlug(slug)}/`, null, { revalidate: 30 });

/** Automatic «أخبار ذات صلة»: ranked by shared tags (people/topics), topped
 * up by the section's latest — computed server-side by /related/. */
export const getRelatedArticles = (slug: string) =>
  safeGet<{ count: number; results: ArticleCard[] }>(`/articles/${encodeSlug(slug)}/related/`, { count: 0, results: [] }, { revalidate: 60 });

/**
 * «الأكثر قراءة» — trending, not lifetime reads.
 *
 * One helper rather than the same query string written out at each of the
 * ten places that render this list, so the ranking rule has a single
 * definition and can't drift between the homepage, the section fronts and
 * /most-read.
 *
 * Orders by `trending_score` (views ÷ hours since publish — see
 * ArticleViewSet._trending_annotations on the backend), not raw `views`. A
 * plain view count only ever accumulates, so a story that merely kept
 * accruing reads over days could still outrank one that's clearly being
 * read *right now* — the client's report. `published_within` narrows the
 * candidate pool on top of that: the decay alone isn't enough, since a
 * story with a very large one-off count (a seeded demo row, something that
 * once went viral) keeps a nonzero score long after it stops being read —
 * the window is what actually retires it from the list rather than just
 * fading its score toward the bottom.
 */
export const MOST_READ_WINDOW_DAYS = 7;

/**
 * How far back «الأكثر قراءة» looks for trending candidates — deliberately
 * much tighter than MOST_READ_WINDOW_DAYS above (which getMostCommented
 * still uses unchanged): a "what's hot right now" list needs a narrow pool,
 * or a story from day six can still out-decay a story from hour one on raw
 * lifetime views. In hours because that's the unit the client actually
 * asked for ("24 or 48 hours"); `published_within` itself only takes whole
 * days, so this is converted at the call site below.
 */
export const MOST_READ_TRENDING_WINDOW_HOURS = 48;

export const getMostRead = (lang: "ar" | "en" = "ar", limit = 5) =>
  safeGet<Paginated<ArticleCard>>(
    `/articles/?language=${lang}&ordering=-trending_score&published_within=${Math.round(MOST_READ_TRENDING_WINDOW_HOURS / 24)}&page_size=${limit}`,
    { count: 0, next: null, previous: null, results: [] },
    // 30s, not 60: this is the one list on the page a reader's own actions
    // change, so it should visibly answer them. Below ~30s the homepage's
    // two dozen API calls start rebuilding faster than they are read.
    { revalidate: 30 },
  );

/**
 * One section's feed — the homepage category blocks and the section fronts.
 *
 * Strictly newest-first. It used to lead with `-pinned`, which made
 * «الظهور في الرئيسية» a permanent override on a chronological list: six
 * pinned Gulf stories, the freshest 22 hours old, sat above one published an
 * hour earlier, so the section looked frozen for days. The flag still leads
 * the hero, which is the surface it was built for.
 */
export const getSectionFeed = (lang: "ar" | "en", key: string, limit = 6) =>
  safeGet<Paginated<ArticleCard>>(
    `/articles/?language=${lang}&section__key=${encodeURIComponent(key)}&ordering=-published_at&page_size=${limit}`,
    { count: 0, next: null, previous: null, results: [] },
    { revalidate: 60 },
  );

/**
 * «الأحدث» — the newest stories, by publish time.
 *
 * Nothing subtle, and nothing here was broken; it is a named helper so the
 * homepage's two «أحدث الأخبار» tabs read as a pair and neither can drift
 * into a different rule than the other.
 */
export const getLatest = (lang: "ar" | "en" = "ar", limit = 12) =>
  safeGet<Paginated<ArticleCard>>(
    `/articles/?language=${lang}&ordering=-published_at&page_size=${limit}`,
    { count: 0, next: null, previous: null, results: [] },
    { revalidate: 60 },
  );

/**
 * «الأكثر تعليقاً» — the other tab of that same block.
 *
 * Windowed for exactly the reason «الأكثر قراءة» is: a comment count only
 * ever goes up, so an unbounded ranking is an all-time leaderboard that the
 * oldest stories hold permanently. Every seeded comment in this database
 * sits on an article from the demo import, which is why this tab led with
 * three-week-old demo copy while the «الأحدث» tab beside it was showing
 * today's news correctly — the same list, one tab apart, disagreeing about
 * what year it was.
 */
export const getMostCommented = (lang: "ar" | "en" = "ar", limit = 6) =>
  safeGet<Paginated<ArticleCard>>(
    `/articles/?language=${lang}&ordering=-comment_count&published_within=${MOST_READ_WINDOW_DAYS}&page_size=${limit}`,
    { count: 0, next: null, previous: null, results: [] },
    { revalidate: 60 },
  );

/**
 * Count one read of an article. Fire-and-forget: a reader must never wait
 * for, or be shown a failure from, analytics.
 *
 * Nothing incremented `Article.views` before this existed — the column's
 * only writer was the demo seed — which is why the most-read list could
 * never change. See the backend's track_view action.
 */
export function trackArticleView(slug: string): void {
  const url = `${API_URL}/articles/${encodeSlug(slug)}/track-view/`;
  try {
    // sendBeacon survives the reader navigating away mid-request, which a
    // plain fetch does not; keepalive fetch is the fallback where it is
    // missing or refuses the queue.
    if (!navigator.sendBeacon || !navigator.sendBeacon(url)) {
      fetch(url, { method: "POST", keepalive: true }).catch(() => {});
    }
  } catch {
    /* never the reader's problem */
  }
}

export const getSections = (opts?: FetchOptions) => safeGet<Paginated<Section>>(`/sections/`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getSection = (key: string) => safeGet<Section | null>(`/sections/${encodeSlug(key)}/`, null);

export const getTags = (opts?: FetchOptions) => safeGet<Paginated<Tag>>(`/tags/`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getAuthors = (opts?: FetchOptions) => safeGet<Paginated<Author>>(`/authors/`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getAuthor = (username: string) => safeGet<Author | null>(`/authors/${encodeSlug(username)}/`, null);

export const getBreakingNews = (query = "?active=true", opts: FetchOptions = { revalidate: 30 }) =>
  safeGet<Paginated<BreakingNewsItem>>(`/breaking/${query}`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getVideos = (query = "", opts?: FetchOptions) => safeGet<Paginated<Video>>(`/videos/${query}`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getVideo = (slug: string) =>
  safeGet<VideoDetail | null>(`/videos/${encodeSlug(slug)}/`, null, { revalidate: 30 });

export const getTicker = () =>
  safeGet<TickerPayload>(
    `/ticker/`,
    { currencies: [], gold: [], weather: null, cities: [], modules: [] },
    { revalidate: 60 },
  );

// 60s, not 300: the masthead reads the logo from here, and an editor who
// uploads one should not wait five minutes to see it on the site.
export const getSiteSettings = (opts: FetchOptions = { revalidate: 60 }) =>
  safeGet<SiteSettings | null>(`/settings/`, null, opts);

// --------------------------------------------------------------- dashboard
export const getDashboardOverview = () =>
  safeGet<DashboardOverview | null>(`/dashboard/overview/`, null, { revalidate: 0 });

export const getComments = (query = "") =>
  safeGet<Paginated<Comment>>(`/comments/${query}`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getAdPlacements = () =>
  safeGet<Paginated<AdPlacement>>(`/ads/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getTickerModules = () =>
  safeGet<Paginated<TickerModule>>(`/ticker-modules/?ordering=order`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getMediaAssets = (query = "") =>
  safeGet<Paginated<MediaAsset>>(`/media/${query}`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getUsers = () =>
  safeGet<Paginated<DashUser>>(`/users/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

/**
 * The «أهم ما يجري اليوم» rail. Newest first, so in RTL the freshest story
 * sits at the far right where the eye starts.
 *
 * `page_size` is deliberately larger than the 13 cards the rail shows (see
 * StoriesRail's MAX_STORIES, which is what actually caps it). Stories carry
 * no language column, so each edition filters the rows by the script their
 * title is written in — asking the API for exactly 13 would hand the Arabic
 * rail 13 rows minus however many of them were English, and quietly render
 * nine cards. Fetching the pool and capping after that filter is what makes
 * the cap mean 13 on screen.
 */
export const getStories = () =>
  safeGet<Paginated<Story>>(`/stories/?active=true&ordering=-created_at&page_size=40`, {
    count: 0,
    next: null,
    previous: null,
    results: [],
  });

export const getWelcomeAlert = () =>
  safeGet<WelcomeAlert | null>(`/welcome-alert/`, null);

export const getUrgentNotification = (lang: "ar" | "en" = "ar") =>
  safeGet<UrgentNotification>(`/urgent-notification/?language=${lang}`, {});

// ------------------------------------------------------- external feeds
export const getPrayerTimes = (city = "cairo") =>
  safeGet<PrayerTimes | null>(`/prayer-times/?city=${encodeURIComponent(city)}`, null, { revalidate: 900 });

export const getMatches = (query = "?ordering=-kickoff_at&page_size=6") =>
  safeGet<Paginated<Match>>(`/matches/${query}`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 120 });

export const getWireArticles = (query = "?page_size=6", opts: FetchOptions = { revalidate: 300 }) =>
  safeGet<Paginated<WireArticle>>(`/wire/${query}`, { count: 0, next: null, previous: null, results: [] }, opts);

export const getSyncLogs = () =>
  safeGet<Paginated<SyncLog>>(`/sync-logs/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

// -------------------------------------------------------------- mutations

/** Read the CSRF cookie Django set. Not HttpOnly precisely so we can echo it. */
function csrfFromCookie(): string {
  if (typeof document === "undefined") return "";
  const hit = document.cookie.split("; ").find((c) => c.startsWith("csrftoken="));
  return hit ? decodeURIComponent(hit.slice("csrftoken=".length)) : "";
}

/** Ask the API to issue one if this browser has never had it. */
async function ensureCsrf(): Promise<string> {
  const existing = csrfFromCookie();
  if (existing) return existing;
  try {
    await fetch(`${API_URL}/auth/csrf/`, { credentials: "include" });
  } catch {
    /* offline — the mutation below will surface the failure */
  }
  return csrfFromCookie();
}

/**
 * Multipart variant of apiMutate for file fields (the Settings logo).
 * Content-Type is deliberately unset so the browser writes the multipart
 * boundary itself; forcing application/json here silently breaks the upload.
 */
export async function apiUpload<T>(path: string, method: "POST" | "PATCH" | "PUT", form: FormData): Promise<T> {
  const token = await ensureCsrf();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    body: form,
    credentials: "include",
    headers: token ? { "X-CSRFToken": token } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new ApiError(path, res.status, res.statusText, await readErrorBody(res));
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiMutate<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  // Django rejects unsafe methods under SessionAuthentication without this
  // header. Every dashboard write went through here, so it is fetched once
  // per browser and reused from the cookie afterwards.
  const token = await ensureCsrf();
  return apiFetch<T>(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: token ? { "X-CSRFToken": token } : {},
    revalidate: 0,
  });
}

/**
 * apiMutate + apiUpload for dashboard writes: same call, but the public side's
 * cached renders are dropped afterwards so the change is live immediately
 * rather than at the end of that page's revalidate window.
 *
 * Reader-side writes (posting a comment, subscribing to alerts) keep using the
 * plain versions — one reader's comment shouldn't rebuild the whole site.
 *
 * The revalidation is awaited but its failure is swallowed: the write already
 * landed, so reporting an error here would tell the editor their save failed
 * when it didn't. Worst case the page falls back to its normal TTL.
 */
export async function dashMutate<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const result = await apiMutate<T>(path, method, body);
  await revalidatePublicPages();
  return result;
}

export async function dashUpload<T>(path: string, method: "POST" | "PATCH" | "PUT", form: FormData): Promise<T> {
  const result = await apiUpload<T>(path, method, form);
  await revalidatePublicPages();
  return result;
}

async function revalidatePublicPages(): Promise<void> {
  try {
    const { revalidateSite } = await import("./revalidate");
    await revalidateSite();
  } catch {
    // Server action unreachable (offline, mid-deploy) — the write stands.
  }
}

// ------------------------------------------------------------------- auth
/**
 * What a dashboard screen may open, published by the API alongside the
 * account (see accounts/serializers.py's AccountSerializer).
 *
 * Read as a convenience for the interface, never as the enforcement: each key
 * mirrors a permission class the API applies to the same resource, so hiding
 * a screen here only saves the reader a refusal they would have got anyway.
 */
export type DashboardPermissions = {
  articles: boolean;
  media: boolean;
  comments: boolean;
  taxonomy: boolean;
  videos: boolean;
  breaking: boolean;
  ads: boolean;
  ticker: boolean;
  feeds: boolean;
  authors: boolean;
  users: boolean;
  settings: boolean;
};

export type Capability = keyof DashboardPermissions;

export type Account = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  is_staff_member: boolean;
  must_change_password: boolean;
  permissions: DashboardPermissions;
};

export const getMe = () =>
  safeGet<{ authenticated: boolean } & Partial<Account>>(`/auth/me/`, { authenticated: false }, { revalidate: 0 });

export const login = (username: string, password: string) =>
  apiMutate<Account>("/auth/login/", "POST", { username, password });

export const logout = () => apiMutate<void>("/auth/logout/", "POST");

export const register = (email: string, password: string, name: string) =>
  apiMutate<Account>("/auth/register/", "POST", { email, password, name });
