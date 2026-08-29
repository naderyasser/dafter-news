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
