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
};

export type Tag = { id: number; name: string; slug: string };

export type Author = {
  id: number;
  username: string;
  name: string;
  initial: string;
  bio: string;
  title: string;
  avatar: string | null;
  article_count: number;
  date_joined: string;
};

export type ArticleCard = {
  id: number;
  title: string;
  slug: string;
  href_slug: string;
  section_name: string;
  badge: Badge;
  status: ArticleStatus;
  cover_image: string | null;
  published_at: string | null;
  views: number;
  kind: "news" | "opinion";
  comment_count: number;
  author_name: string | null;
  author_username: string | null;
  author_initial: string | null;
};

export type ArticleBlock = {
  id: number;
  order: number;
  type: "paragraph" | "heading" | "image" | "quote" | "related";
  text: string;
  image: string | null;
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
  author: Author | null;
  tags: Tag[];
  language: "ar" | "en";
  related_article: number | null;
  status: ArticleStatus;
  badge: Badge;
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

export type TickerModule = { id: number; key: string; label: string; source: string; active: boolean; order: number };

export type TickerPayload = {
  currencies: Currency[];
  gold: GoldKarat[];
  weather: WeatherCity | null;
  cities: WeatherCity[];
  modules: TickerModule[];
};

export type MediaAsset = { id: number; image: string; alt: string; credit: string; created_at: string };

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
