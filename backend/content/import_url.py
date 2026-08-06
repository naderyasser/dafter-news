"""
«استيراد من رابط» — pull a starting draft out of another site's article page:
title, standfirst, body paragraphs and a lead image, landed as an
Article/MediaAsset the same way a manual save would.

This exists to speed up the "read their reporting, write our own version"
workflow, not to republish someone else's copy verbatim under our byline —
see WireArticle's own docstring (integrations/providers/newswire.py) for why
that distinction is drawn everywhere else in this codebase. Two things keep
that honest here:

  * The imported article always lands as a draft (never auto-published —
    see ImportFromUrlView), so a person reviews it before anything goes
    out under الدفتر نيوز's name.
  * The source is credited automatically, not left for someone to remember —
    the byline gets "منقول عن <domain>" and the pulled image's MediaAsset
    gets `source`/`credit` set to the original URL/domain. Clearing that is
    a deliberate, visible edit an editor has to make themselves; it never
    happens silently.

Fetching an editor-supplied URL server-side is an SSRF surface — a
malicious or compromised staff session could point this at internal
infrastructure. _guarded_get() resolves the host and refuses private/
loopback/link-local targets before connecting, re-validates redirects the
same way instead of trusting them blindly, and caps both timeout and
response size.
"""
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = "AlDaftarNews/1.0 (+https://aldaftarnews.com; article importer)"
FETCH_TIMEOUT = 10
MAX_BYTES = 5 * 1024 * 1024  # a news article page has no business being bigger than this
MAX_REDIRECTS = 3
# Short paragraphs at this length are almost always nav/footer/boilerplate
# ("اشترك الآن", a byline line, a share-button label), not article prose.
MIN_PARAGRAPH_CHARS = 40


class ImportError_(Exception):
    """Anything that stops an import short, with a message safe to show an editor."""


def _is_public_host(hostname):
    try:
        infos = socket.getaddrinfo(hostname, None)
    except OSError:  # socket.gaierror is the common case, but any resolution failure means "can't verify, refuse"
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
            return False
    return True


def _guarded_fetch(url, accept, max_bytes=MAX_BYTES):
    """GET `url`, refusing private/internal targets — including ones a
    redirect chain tries to hand off to — and capping the response size.
    Returns (raw bytes, encoding-or-None, final url, content-type)."""
    for _ in range(MAX_REDIRECTS + 1):
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise ImportError_("الرابط لازم يبدأ بـ http:// أو https://")
        if not parsed.hostname or not _is_public_host(parsed.hostname):
            raise ImportError_("تعذّر الوصول إلى هذا الرابط.")

        res = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": accept},
            timeout=FETCH_TIMEOUT,
            allow_redirects=False,
            stream=True,
        )
        if res.is_redirect or res.is_permanent_redirect:
            location = res.headers.get("Location")
            res.close()
            if not location:
                raise ImportError_("تعذّر الوصول إلى هذا الرابط.")
            url = urljoin(url, location)
            continue

        if res.status_code != 200:
            res.close()
            raise ImportError_(f"الموقع رجّع خطأ ({res.status_code}).")

        content = bytearray()
        for chunk in res.iter_content(8192):
            content += chunk
            if len(content) > max_bytes:
                res.close()
                raise ImportError_("الملف أكبر من المتوقع — تعذّر الاستيراد.")
        content_type = res.headers.get("Content-Type", "")
        encoding = res.encoding
        res.close()
        return bytes(content), encoding, url, content_type

    raise ImportError_("عدد كبير جداً من إعادة التوجيه لهذا الرابط.")


def _guarded_get(url):
    """The HTML page itself, decoded to text."""
    raw, encoding, final_url, _ = _guarded_fetch(url, "text/html")
    return raw.decode(encoding or "utf-8", errors="replace"), final_url


def fetch_image_bytes(url):
    """The lead image's raw bytes and content-type, for building a
    MediaAsset — same SSRF guard as the page fetch, smaller size cap."""
    raw, _, _, content_type = _guarded_fetch(url, "image/*", max_bytes=8 * 1024 * 1024)
    return raw, content_type


def _meta(soup, *names):
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            return tag["content"].strip()
    return ""


def _best_paragraphs(soup):
    """
    Simplified readability heuristic: group every <p> by its parent element,
    and take the group with the most cumulative text — the article body is
    reliably the single biggest cluster of real paragraphs on a news page;
    nav/sidebar/footer links are short and scattered across many small
    unrelated containers instead.
    """
    groups = {}
    for p in soup.find_all("p"):
        text = re.sub(r"\s+", " ", p.get_text(" ", strip=True)).strip()
        if len(text) < MIN_PARAGRAPH_CHARS:
            continue
        groups.setdefault(id(p.parent), []).append(text)
    if not groups:
        return []
    return max(groups.values(), key=lambda texts: sum(len(t) for t in texts))


def extract_article(url):
    """Fetch `url` and pull out a starting draft. Raises ImportError_ with an
    Arabic, editor-facing reason on anything that goes wrong."""
    html, final_url = _guarded_get(url)
    soup = BeautifulSoup(html, "html.parser")

    title = _meta(soup, "og:title", "twitter:title") or (soup.title.get_text(strip=True) if soup.title else "")
    standfirst = _meta(soup, "og:description", "twitter:description", "description")
    image = _meta(soup, "og:image", "twitter:image")
    if image:
        image = urljoin(final_url, image)

    paragraphs = _best_paragraphs(soup)
    if not title and not paragraphs:
        raise ImportError_("لم يُعثر على محتوى خبر قابل للاستيراد بهذا الرابط.")

    return {
        "title": title[:280],
        "standfirst": standfirst[:2000],
        "paragraphs": paragraphs,
        "image_url": image,
        "source_url": final_url,
        "source_domain": urlparse(final_url).netloc,
    }
