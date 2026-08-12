// Shapes mirror the DRF serializers in backend/*/serializers.py.

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type Badge = "none" | "breaking" | "exclusive" | "live";
export type ArticleStatus = "draft" | "review" | "scheduled" | "published" | "rejected";
export type Role = "admin" | "editor" | "author" | "moderator";

export type Section = {
  id: number;
  key: string;
  name_ar: string;
  name_en: string;
  order: number;
  article_count: number;
  cover_image: string | null;
  tagline: string;
};

export type Tag = { id: number; name: string; slug: string };

export type Author = {
  id: number;
  username: string;
  name: string;
  name_en: string;
  initial: string;
  bio: string;
  title: string;
  avatar: string | null;
  is_hidden: boolean;
  article_count: number;
  /** Opinion pieces only — what the «بالعقل والمنطق» card counts. */
  opinion_count: number;
  date_joined: string;
};

export type ArticleCard = {
  id: number;
  title: string;
  slug: string;
  href_slug: string;
  section_name: string;
  subcategory: string;
  country: string;
  badge: Badge;
  status: ArticleStatus;
  cover_image: string | null;
  published_at: string | null;
  views: number;
  kind: "news" | "opinion";
  comment_count: number;
  author_name: string | null;
  /** Byline for English surfaces; falls back to author_name when unset. */
  author_name_en: string | null;
  author_username: string | null;
  author_initial: string | null;
  /** The journalist chip on «ملف خاص» cards. */
  author_avatar: string | null;
  /** Deck line — the magazine archetype puts it under the headline. */
  standfirst: string;
};

export type ArticleBlock = {
  id: number;
  order: number;
  type: "paragraph" | "heading" | "image" | "quote" | "related";
  text: string;
  /** Paragraph alignment — the editor's left/center/right/justify menu.
   *  Meaningful for paragraph/quote blocks only. */
  align: "left" | "center" | "right" | "justify";
  image: string | null;
  /** Stored file name (e.g. library/x.jpg) — echoed back on save as
   * keep_image so re-saving an article doesn't strip its photos. */
  image_name: string;
  caption: string;
  credit: string;
  related_article: number | null;
  related_article_slug: string | null;
};

export type ArticleDetail = {
  id: number;
  title: string;
  slug: string;
  kind: "news" | "opinion";
  section: Section | null;
  subcategory: string;
  country: string;
  author: Author | null;
  /** Manual byline typed in the editor — wins over `author`'s name
   *  wherever a card/list shows one; see content/serializers.py. */
  byline: string;
  tags: Tag[];
  language: "ar" | "en";
  related_article: number | null;
  status: ArticleStatus;
  badge: Badge;
  pinned: boolean;
  standfirst: string;
  cover_image: string | null;
  cover_caption: string;
  cover_credit: string;
  views: number;
  read_minutes: number;
  tts_status: "idle" | "generating" | "done";
  tts_audio: string | null;
  tts_duration_seconds: number;
  published_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  blocks: ArticleBlock[];
  comments: ArticleComment[];
};

/** A reader-safe comment row as embedded on the article detail — the
 *  moderation columns (status, article) deliberately never travel here. */
export type ArticleComment = {
  id: number;
  user_name: string;
  text: string;
  created_at: string;
};

export type Comment = {
  id: number;
  article: number;
  article_title: string;
  user_name: string;
  text: string;
  status: "pending" | "approved" | "banned";
  created_at: string;
};

export type BreakingNewsItem = {
  id: number;
  text: string;
  /** Where the ticker entry leads; blank renders as plain text. */
  href: string;
  order: number;
  active: boolean;
  expires_at: string;
  created_at: string;
};

export type Video = {
  id: number;
  title: string;
  slug: string;
  section: number | null;
  section_name: string;
  description: string;
  cover_image: string | null;
  file: string | null;
  external_url: string;
  duration_seconds: number;
  duration_label: string;
  is_live: boolean;
  is_exclusive: boolean;
  views: number;
  comment_count: number;
  created_at: string;
};

export type VideoComment = { id: number; video: number; name: string; initial: string; text: string; created_at: string };

export type VideoDetail = Video & { comments: VideoComment[] };

export type LiveUpdate = { id: number; stream: number; time_label: string; text: string; created_at: string };

export type LiveStream = {
  id: number;
  title: string;
  is_live: boolean;
  cover_image: string | null;
  stream_url: string;
  updates: LiveUpdate[];
  created_at: string;
};

export type AdPlacement = {
  id: number;
  name: string;
  size: string;
  active: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  order: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
};

export type Currency = {
  id: number;
  flag_emoji: string;
  code: string;
  buy: string;
  sell: string;
  change_pct: string;
  is_up: boolean;
  series: number[];
  order: number;
};

export type GoldKarat = { id: number; label: string; price: string; change_pct: string; is_up: boolean; order: number };

export type WeatherCity = {
  id: number;
  key: string;
  label: string;
  icon: string;
  temp: number;
  hi: number;
  lo: number;
  humidity: number;
  order: number;
};

export type TickerModule = {
  id: number;
  key: string;
  label: string;
  source: string;
  active: boolean;
  order: number;
  /** Seconds between public-ticker refreshes for this module (minimum 15). */
  refresh_seconds: number;
};

export type TickerPayload = {
  currencies: Currency[];
  gold: GoldKarat[];
  weather: WeatherCity | null;
  cities: WeatherCity[];
  modules: TickerModule[];
};

export type MediaLicense = "owned" | "agency" | "cc" | "permission" | "unknown";

export type MediaAsset = {
  id: number;
  image: string;
  title: string;
  alt: string;
  credit: string;
  license: MediaLicense;
  license_label: string;
  source: string;
  article: number | null;
  article_title: string | null;
  article_slug: string | null;
  created_at: string;
};

export type DashUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: Role;
  last_login: string | null;
  is_active: boolean;
  date_joined: string;
};

export type SiteSettings = {
  id: number;
  site_name: string;
  tagline: string;
  logo: string | null;
  seo_title: string;
  seo_description: string;
  lang_ar_enabled: boolean;
  lang_en_enabled: boolean;
  social_links: { id: number; platform: string; url: string }[];
};

export type DashboardOverview = {
  /** Sources that have been failing ≥3 runs — the overview's warning banner. */
  feed_alerts: {
    source: string;
    label: string;
    consecutive_failures: number;
    last_success_at: string | null;
    message: string;
  }[];
  stats: {
    visits_today: number;
    visits_change_pct: number;
    published_articles: number;
    pending_comments: number;
    video_views: number;
  };
  chart: { label: string; value: number; bar_pct: number }[];
  recent_articles: { id: number; title: string; section: string; status: ArticleStatus; views: number }[];
  review_queue: { id: number; title: string; author: string; slug: string }[];
};

export type Story = {
  id: number;
  title: string;
  image: string | null;
  href: string;
  section: number | null;
  section_name: string | null;
  active: boolean;
  order: number;
};

export type WelcomeAlert = {
  id: number;
  active: boolean;
  kicker: string;
  title: string;
  text: string;
  cta_label: string;
  cta_href: string;
  image: string | null;
};

export type PrayerTimes = {
  id: number;
  city_key: string;
  date: string;
  hijri_date: string;
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
};

export type Match = {
  id: number;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  score_label: string;
  status: "scheduled" | "live" | "finished";
  kickoff_at: string | null;
  round_label: string;
  venue: string;
};

export type WireArticle = {
  id: number;
  title: string;
  summary: string;
  url: string;
  image_url: string;
  source_name: string;
  provider: string;
  language: string;
  published_at: string | null;
};

export type SyncLog = {
  id: number;
  source: string;
  label: string;
  status: "ok" | "failed" | "skipped";
  message: string;
  records: number;
  last_attempt_at: string | null;
  last_success_at: string | null;
  consecutive_failures: number;
  is_stale: boolean;
};
