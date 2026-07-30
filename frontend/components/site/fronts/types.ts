import type { Badge } from "@/lib/types";

/**
 * One story, shaped once by the section page and handed to whichever front
 * that desk wears.
 *
 * Every front takes this same list. The page maps the API rows once, so a
 * field that arrives renamed breaks in one place rather than in thirteen, and
 * a front can be swapped onto another desk without touching the page.
 *
 * `standfirst` is already de-duplicated against the title by the page (see
 * standfirstFor) — a front can print it without checking, and an undefined
 * standfirst means there genuinely is no second sentence to print.
 */
export type FrontStory = {
  id: number;
  href: string;
  title: string;
  standfirst?: string;
  imageSrc?: string;
  /** «منذ ٣ أيام» — for fronts that show elapsed time. */
  time: string;
  /** Raw timestamp, for fronts that group or stamp by day. */
  iso?: string | null;
  badge: Badge;
  views: number;
  /** «السعودية» / «أوروبا» — populated on the geographic desks only. */
  country?: string;
  /** «حرب إيران» / «اقتصاد» — the story's subject line, where the desk keeps one. */
  subject?: string;
  authorName?: string;
  authorAvatar?: string;
  authorInitial?: string;
  comments?: number;
};

export type FrontProps = {
  lang: "ar" | "en";
  /** The desk's own colour — every front tints from this, none hardcodes one. */
  accent: string;
  sectionKey: string;
  title: string;
  tagline?: string;
  stories: FrontStory[];
};
