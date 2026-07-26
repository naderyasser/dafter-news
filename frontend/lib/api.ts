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
  Story,
  WelcomeAlert,
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

type FetchOptions = RequestInit & { revalidate?: number };

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { revalidate, ...init } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    // Public pages read fresh-ish data; dashboard mutations opt out via revalidate:0/no-store.
    next: revalidate !== undefined ? { revalidate } : { revalidate: 60 },
    cache: revalidate === 0 ? "no-store" : undefined,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${res.statusText}`);
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
export const getArticles = (query = "") =>
  safeGet<Paginated<ArticleCard>>(`/articles/${query}`, { count: 0, next: null, previous: null, results: [] });

/** Slugs may be Arabic (see Article.save()). Route params arrive
 * percent-encoded — and re-encoded again by middleware — so decode fully
 * before re-encoding once, instead of forwarding a double-encoded slug
 * the API would never match. */
const encodeSlug = (slug: string) => encodeURIComponent(decodeParam(slug));

export const getArticle = (slug: string) =>
  safeGet<ArticleDetail | null>(`/articles/${encodeSlug(slug)}/`, null, { revalidate: 30 });

export const getSections = () => safeGet<Paginated<Section>>(`/sections/`, { count: 0, next: null, previous: null, results: [] });

export const getSection = (key: string) => safeGet<Section | null>(`/sections/${encodeSlug(key)}/`, null);

export const getTags = () => safeGet<Paginated<Tag>>(`/tags/`, { count: 0, next: null, previous: null, results: [] });

export const getAuthors = () => safeGet<Paginated<Author>>(`/authors/`, { count: 0, next: null, previous: null, results: [] });

export const getAuthor = (username: string) => safeGet<Author | null>(`/authors/${encodeSlug(username)}/`, null);

export const getBreakingNews = (query = "?active=true") =>
  safeGet<Paginated<BreakingNewsItem>>(`/breaking/${query}`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 30 });

export const getVideos = (query = "") => safeGet<Paginated<Video>>(`/videos/${query}`, { count: 0, next: null, previous: null, results: [] });

export const getVideo = (slug: string) =>
  safeGet<VideoDetail | null>(`/videos/${encodeSlug(slug)}/`, null, { revalidate: 30 });

export const getLiveStreams = () =>
  safeGet<Paginated<LiveStream>>(`/live-streams/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 15 });

export const getTicker = () =>
  safeGet<TickerPayload>(
    `/ticker/`,
    { currencies: [], gold: [], weather: null, cities: [], modules: [] },
    { revalidate: 60 },
  );

export const getSiteSettings = () =>
  safeGet<SiteSettings | null>(`/settings/`, null, { revalidate: 300 });

// --------------------------------------------------------------- dashboard
export const getDashboardOverview = () =>
  safeGet<DashboardOverview | null>(`/dashboard/overview/`, null, { revalidate: 0 });

export const getComments = (query = "") =>
  safeGet<Paginated<Comment>>(`/comments/${query}`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getAdPlacements = () =>
  safeGet<Paginated<AdPlacement>>(`/ads/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getTickerModules = () =>
  safeGet<Paginated<TickerModule>>(`/ticker-modules/?ordering=order`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getMediaAssets = () =>
  safeGet<Paginated<MediaAsset>>(`/media/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getUsers = () =>
  safeGet<Paginated<DashUser>>(`/users/`, { count: 0, next: null, previous: null, results: [] }, { revalidate: 0 });

export const getStories = () =>
  safeGet<Paginated<Story>>(`/stories/?active=true&ordering=order`, { count: 0, next: null, previous: null, results: [] });

export const getWelcomeAlert = () =>
  safeGet<WelcomeAlert | null>(`/welcome-alert/`, null);

// -------------------------------------------------------------- mutations
export async function apiMutate<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    revalidate: 0,
  });
}
