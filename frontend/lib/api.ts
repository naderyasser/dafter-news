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
  LiveStream,
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
  const forwarded = await serverCookieHeader();
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

export const getLiveStreams = (opts: FetchOptions = { revalidate: 15 }) =>
  safeGet<Paginated<LiveStream>>(`/live-streams/`, { count: 0, next: null, previous: null, results: [] }, opts);

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

export const getStories = () =>
  safeGet<Paginated<Story>>(`/stories/?active=true&ordering=order`, { count: 0, next: null, previous: null, results: [] });

export const getWelcomeAlert = () =>
  safeGet<WelcomeAlert | null>(`/welcome-alert/`, null);

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
export type Account = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  is_staff_member: boolean;
};

export const getMe = () =>
  safeGet<{ authenticated: boolean } & Partial<Account>>(`/auth/me/`, { authenticated: false }, { revalidate: 0 });

export const login = (username: string, password: string) =>
  apiMutate<Account>("/auth/login/", "POST", { username, password });

export const logout = () => apiMutate<void>("/auth/logout/", "POST");

export const register = (email: string, password: string, name: string) =>
  apiMutate<Account>("/auth/register/", "POST", { email, password, name });
