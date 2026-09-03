/**
 * The newsroom's own URL, in one place.
 *
 * It is deliberately not `/dashboard`: that path is the first thing every
 * scanner and credential-stuffing bot on the internet tries, and a login form
 * it never finds is a login form it never hammers. Renaming it cut that noise
 * without changing who may actually get in.
 *
 * Be clear about what this is and isn't. It is NOT the security boundary —
 * the boundary is the session gate on the route plus the role checks the API
 * enforces on every request (backend/aldaftar/permissions.py). A URL is a
 * secret that leaks: it sits in browser history, in the Referer header of any
 * outbound link, in a screenshot shared over WhatsApp. Treat it as one less
 * open door, never as the lock.
 *
 * Everything links through here so the next rename is this one line, not a
 * grep across forty files — which is what the last one would have been.
 *
 * NB: `/api/dashboard/overview/` is an API endpoint, not this route, and has
 * nothing to do with this constant.
 */
export const DASHBOARD = "/daftardashboard1595";

/** Build a path inside the newsroom: `dash("/articles")`. */
export const dash = (path = "") => `${DASHBOARD}${path}`;

/**
 * Where a story's own page lives, on either edition.
 *
 * Opinion pieces are gated by `kind`, not by section or language — they
 * publish at /opinion/[slug] on the Arabic site, and /article/[slug] rejects
 * them (see app/article/[slug]/page.tsx's generateMetadata, which 404s
 * anything but kind === "news"). The English edition has no /en/opinion
 * route; /en/article/[slug] accepts any English article regardless of kind
 * (mirrors lib/rss.ts's articleUrl).
 *
 * Every list that links to a story — home page blocks, section/tag/author
 * pages, "most read"/"latest" rails, 404's suggestions — has to route
 * opinion pieces here instead of guessing /article/ for everything, or a
 * columnist's byline anywhere outside its own section turns into a 404.
 */
export function articleHref(a: { kind: "news" | "opinion"; slug: string }, lang: "ar" | "en" = "ar"): string {
  if (lang === "en") return `/en/article/${a.slug}`;
  return a.kind === "opinion" ? `/opinion/${a.slug}` : `/article/${a.slug}`;
}
