"""
Pull a reel's title and poster frame out of the Facebook page its link points at.

The newsroom pastes a reel URL and nothing else. Facebook already renders a
frame of that video, and a caption, into the page's Open Graph tags — the same
picture and text it shows when the link is shared anywhere — so both are
sitting there for the taking and asking an editor to retype them was busywork.

Three things about doing this are not obvious, and all three are load-bearing:

1. Facebook answers a browser-shaped User-Agent for a `/reel/…` URL with HTTP
   400 and no tags at all. It serves the Open Graph block only to its own link
   crawler, so that is the agent this sends — `facebookexternalhit/1.1`, the
   string Meta publishes for exactly this purpose. Measured against a live
   reel: a Chrome UA got 400, the crawler UA got 200 and a complete tag set.

2. og:title is not the caption. On the same reel, og:title came back as
   "2,2 тыс. просмотров | صرف مستشفى العامرية بالإسكندرية يغرق الشارع.. استغاثة
   من الأهالي بسبب تسرب مياه الصرف أمام المستشفى | الدفتر - aldaftar" — a
   Facebook-generated view-count in whatever locale it rendered with, THEN the
   real headline, THEN the page's own site-name suffix. og:description on that
   same page was the headline alone, with neither wrapper. That is why this
   prefers description over title rather than lightly cleaning up the title:
   stripping an unpredictable leading stat and a trailing " | Sitename" by
   pattern-matching is exactly the kind of heuristic that holds for one sample
   and breaks on the next; reading the field Facebook already put the clean
   text in does not.

3. The og:image URL is NOT a durable address. It is an fbcdn link carrying a
   signature and an `oe=` expiry — 4.4 days out on the reel this was built
   against. Storing that URL as the thumbnail would put a working picture on
   the home page this week and a broken one next week, on every card at once.
   So the bytes are fetched once and saved into the Reel's own ImageField,
   where the picture survives the signature expiring and is served through the
   site's own image optimiser rather than hot-linked off Facebook on every
   page view.

Also worth knowing: Facebook's markup HTML-escapes tag content as numeric
character references rather than raw UTF-8 — an Arabic headline arrives as a
run of `&#x627;&#x644;…` — so both the picked text and the image URL go
through a real HTML-entity decode, not a bespoke `&amp;` replace.
"""

import html
import logging
import re
from urllib.parse import urlparse, urlunparse

import requests
from django.core.files.base import ContentFile

log = logging.getLogger(__name__)

#: Meta's own published crawler agent. See the module docstring — a normal
#: browser UA is refused outright, so this is not cosmetic.
SCRAPER_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"

#: Hosts a reel link may point at.
#:
#: `facebook_url` is typed by a member of staff, and without this the field is a
#: server-side fetch of any address they paste — including the cloud metadata
#: endpoint and anything else reachable from inside this network. An allow-list
#: is also just what the field means: it holds a Facebook reel link.
ALLOWED_HOSTS = frozenset({
    "facebook.com", "www.facebook.com", "m.facebook.com",
    "web.facebook.com", "fb.watch", "www.fb.watch", "fb.me",
})

#: What a reel gets called when Facebook's page carries no usable text at all
#: (a private/deleted video, or a fetch failure) — see attach_scraped_metadata.
#: Deliberately not left blank: an empty title cell in the dashboard list reads
#: as the same "did this render correctly?" doubt an unset thumbnail already
#: caused once, and there is no dashboard affordance yet to rename a reel, so
#: this is what an editor sees until the row is deleted and re-added.
UNTITLED_REEL_TITLE = "ريل بدون عنوان"

#: The model column is varchar(200); Postgres enforces that at the database
#: layer, unlike SQLite, so a long caption without a hard truncation here would
#: turn a successful scrape into a 500 on save.
MAX_TITLE_LENGTH = 200


def _og_patterns(property_name: str) -> tuple[re.Pattern, ...]:
    """
    Both attribute orders for one `property="og:…"` meta tag.

    Facebook's markup is minified with no guaranteed attribute order, so this
    does not assume `property` comes before `content`.
    """
    escaped = re.escape(property_name)
    return (
        re.compile(rf'<meta[^>]+property=["\']{escaped}["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE),
        re.compile(rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']{escaped}["\']', re.IGNORECASE),
    )


_IMAGE_PATTERNS = _og_patterns("og:image") + _og_patterns("og:image:secure_url")
_TITLE_PATTERNS = _og_patterns("og:title")
_DESCRIPTION_PATTERNS = _og_patterns("og:description")

PAGE_TIMEOUT = 12
IMAGE_TIMEOUT = 15
#: A poster frame is a few hundred KB; anything past this is not one, and
#: streaming with a budget is what stops a hostile or broken response from
#: filling the disk.
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class OgScrapeError(Exception):
    """The page could not be fetched at all. Always non-fatal to the save."""


def _host_allowed(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    return (parsed.hostname or "").lower() in ALLOWED_HOSTS


#: Hosts folded onto the canonical `www.facebook.com` once a link has
#: actually been fetched — see _canonicalize_facebook_url.
_MOBILE_HOSTS = frozenset({"facebook.com", "m.facebook.com", "web.facebook.com"})


def _canonicalize_facebook_url(url: str) -> str | None:
    """
    The embeddable form of a Facebook URL Meta itself just redirected to:
    canonical host, no query string.

    This is the fix for the plugin's "Video Unavailable" error on a reel
    that plays fine on Facebook itself. Verified live against a real reel on
    this shelf: staff paste the link the "Share" button hands out, which is
    a `/share/r/<id>/` short link — `requests.get(..., allow_redirects=True)`
    follows it, same as a browser, and lands on
    `/reel/<id>/?rdid=…&share_url=…`. Posting the ORIGINAL short link to
    `/plugins/video.php?href=` came back Facebook's own error box ("Video
    Unavailable" — seen here as `Видео недоступно`, whatever locale Facebook
    answered the request in); posting the RESOLVED `/reel/<id>/` URL came
    back the real player payload every time. The plugin also isn't picky
    about the tracking query string on the resolved URL — a request built
    with `rdid`/`share_url` still intact loaded the player fine — but that's
    unrelated redirect bookkeeping either way, so it is dropped rather than
    stored and reproduced on every future embed. `m.facebook.com` and bare
    `facebook.com` are folded onto `www.facebook.com` on the same
    reasoning: whatever host a mobile share sheet or a `fb.watch`/`fb.me`
    short link resolves to, the plugin gets the one host it was built
    against.

    Returns None when the resolved URL isn't on a host `facebook_url` is
    even allowed to hold (see ALLOWED_HOSTS) — should not happen for
    anything that reached this point, since the original URL already passed
    that same gate before the request was made, but the caller must not
    silently adopt a redirect that left Facebook's own domains.
    """
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        return None
    netloc = "www.facebook.com" if host in _MOBILE_HOSTS else parsed.hostname
    return urlunparse((parsed.scheme or "https", netloc, parsed.path, "", "", ""))


def _first_match(page_html: str, patterns: tuple[re.Pattern, ...]) -> str | None:
    for pattern in patterns:
        match = pattern.search(page_html)
        if match and match.group(1):
            return html.unescape(match.group(1)).strip()
    return None


def extract_og_image(page_html: str) -> str | None:
    """The og:image URL out of a page's markup, or None if it carries none."""
    return _first_match(page_html, _IMAGE_PATTERNS)


def extract_og_title(page_html: str) -> str | None:
    """The raw og:title text — Facebook's view-count wrapper and all. Prefer
    `extract_og_description`; see the module docstring for why."""
    return _first_match(page_html, _TITLE_PATTERNS)


def extract_og_description(page_html: str) -> str | None:
    """The og:description text — the clean caption, with none of og:title's
    view-count prefix or site-name suffix."""
    return _first_match(page_html, _DESCRIPTION_PATTERNS)


def _clean_title(raw: str) -> str:
    # \xa0 (a non-breaking space) shows up in Facebook's own view-count text;
    # collapsing it alongside ordinary whitespace stops one surviving mid-title
    # if a caption is ever used as a last-resort fallback for og:title itself.
    collapsed = re.sub(r"[\s\xa0]+", " ", raw).strip()
    return collapsed[:MAX_TITLE_LENGTH]


def fetch_og_metadata_from_html(page_html: str) -> tuple[str | None, str | None]:
    """
    `(title, image_url)` out of a page's markup — the part of the scrape with
    no network in it, and so the part its own tests exercise directly rather
    than through a mocked `requests.get`.

    description first: see the module docstring's point 2. Title is the
    fallback for the post that has a caption in neither field.
    """
    raw_title = extract_og_description(page_html) or extract_og_title(page_html)
    title = _clean_title(raw_title) if raw_title else None
    return title, extract_og_image(page_html)


def fetch_og_metadata(page_url: str) -> tuple[str | None, str | None, str | None]:
    """
    `(title, image_url, canonical_url)` advertised for this Facebook page.

    Raises OgScrapeError only when the PAGE itself could not be fetched (bad
    host, network failure, non-200). A page that fetches fine but carries only
    one of the two tags is not an error — a login wall is a valid page with
    neither, and there is no reason a caption-less post should cost the reel
    its picture too.

    `canonical_url` is where `allow_redirects` actually landed, cleaned up by
    _canonicalize_facebook_url — see its own docstring for why a short
    `/share/r/…` link (what staff's own "Share" button hands out) has to be
    replaced with this rather than embedded as typed.
    """
    if not _host_allowed(page_url):
        raise OgScrapeError(f"refusing to fetch a non-Facebook host: {page_url!r}")

    try:
        response = requests.get(
            page_url,
            headers={"User-Agent": SCRAPER_UA, "Accept-Language": "ar,en;q=0.8"},
            timeout=PAGE_TIMEOUT,
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        raise OgScrapeError(f"could not reach {page_url}: {exc}") from exc

    if response.status_code != 200:
        raise OgScrapeError(f"{page_url} answered HTTP {response.status_code}")

    title, image_url = fetch_og_metadata_from_html(response.text)
    return title, image_url, _canonicalize_facebook_url(response.url)


def download_image(image_url: str) -> tuple[bytes, str]:
    """The poster's bytes and its file extension. Raises on failure."""
    try:
        response = requests.get(image_url, timeout=IMAGE_TIMEOUT, stream=True)
    except requests.RequestException as exc:
        raise OgScrapeError(f"could not download the poster: {exc}") from exc

    if response.status_code != 200:
        raise OgScrapeError(f"the poster answered HTTP {response.status_code}")

    content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    if not content_type.startswith("image/"):
        raise OgScrapeError(f"the poster is not an image ({content_type!r})")

    # Streamed with a running budget rather than trusting Content-Length, which
    # a response is free to understate or omit.
    chunks, total = [], 0
    for chunk in response.iter_content(64 * 1024):
        total += len(chunk)
        if total > MAX_IMAGE_BYTES:
            raise OgScrapeError("the poster is larger than the size cap")
        chunks.append(chunk)

    if not total:
        raise OgScrapeError("the poster came back empty")

    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}.get(content_type, "jpg")
    return b"".join(chunks), extension


def attach_scraped_metadata(
    reel,
    *,
    want_title: bool = True,
    want_image: bool = True,
    want_url_normalize: bool = True,
    save: bool = True,
) -> tuple[bool, bool]:
    """
    Give `reel` the title and/or poster Facebook advertises for its link —
    and, whenever a scrape runs at all, the embeddable form of wherever that
    link actually resolves to (see _canonicalize_facebook_url).

    Returns `(title_set, image_set)`. Never raises: a reel whose page cannot be
    read is still a perfectly good reel — the newsroom meant to publish it, and
    the card falls back to its placeholder text or picture — so a private
    video or a Facebook outage must not be able to fail the save that created
    it. The caller (ReelSerializer) is what turns a still-blank title into
    UNTITLED_REEL_TITLE, since that fallback belongs to the save, not the
    scrape: a caller that only wants the image (a management backfill, say)
    should not have this function's title-side decide anything for it.

    `want_url_normalize` defaults on: it costs nothing extra (the fetch
    already happened for the title/image) and is the actual fix for a reel
    whose link is a `/share/r/…` short URL — Facebook's embed plugin answers
    that shape with its own "Video Unavailable" error even though the same
    reel plays fine on facebook.com itself. A caller may still turn it off,
    same as the other two, for a backfill pass that means to touch only one
    field.
    """
    if not reel.facebook_url or not (want_title or want_image or want_url_normalize):
        return False, False

    try:
        title, image_url, canonical_url = fetch_og_metadata(reel.facebook_url)
    except OgScrapeError as exc:
        log.warning("reel %s: metadata fetch failed — %s", reel.pk or "(new)", exc)
        title, image_url, canonical_url = None, None, None
    except Exception:  # noqa: BLE001 - a scrape must never break a save
        log.exception("reel %s: unexpected error fetching metadata", reel.pk or "(new)")
        title, image_url, canonical_url = None, None, None

    url_changed = False
    if want_url_normalize and canonical_url and canonical_url != reel.facebook_url:
        log.info("reel %s: normalized facebook_url %r → %r", reel.pk or "(new)", reel.facebook_url, canonical_url)
        reel.facebook_url = canonical_url
        url_changed = True

    title_set = False
    if want_title and title:
        reel.title = title
        title_set = True

    image_set = False
    if want_image and image_url:
        try:
            content, extension = download_image(image_url)
            reel.thumbnail.save(f"reel-{reel.pk or 'new'}.{extension}", ContentFile(content), save=False)
            image_set = True
        except OgScrapeError as exc:
            log.warning("reel %s: no poster fetched — %s", reel.pk or "(new)", exc)
        except Exception:  # noqa: BLE001 - a scrape must never break a save
            log.exception("reel %s: unexpected error fetching the poster", reel.pk or "(new)")

    if save and (title_set or image_set or url_changed):
        reel.save()
    return title_set, image_set
