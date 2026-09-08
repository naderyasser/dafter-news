"""
«حصل إيه؟» — everything a reel needs, read off its YouTube link.

The newsroom pastes a YouTube link (a Short, a watch URL, a youtu.be share
link) and nothing else. Three things are derived from it here:

  * the video id — `extract_video_id`, a pure parser with no network in it,
    which is also what the model's save() stamps into `Reel.youtube_id` and
    what the frontend builds the embed from;
  * the title — YouTube's oEmbed endpoint, which needs no API key;
  * the poster — YouTube's own thumbnail host, tried in order of preference
    (see THUMBNAIL_VARIANTS) and stored into the Reel's own ImageField so it
    is served through the site's image optimiser like every other photo.

Both network halves are best-effort and never raise into the save: a link
whose video is private, deleted or simply unreachable still becomes a row —
the newsroom meant to publish it — and the card falls back to the untitled
placeholder text and no poster until someone retries or uploads one by hand.

Fetches only ever go to the fixed YouTube hosts below, never to a URL the
editor typed: `extract_video_id` reduces the pasted link to an eleven-
character id and everything else is built from that, so there is no
server-side fetch of an arbitrary address for a malicious link to exploit.
"""

import io
import logging
import re
from urllib.parse import parse_qs, urlparse

import requests
from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError

log = logging.getLogger(__name__)

#: Hosts a reel link may point at.
ALLOWED_HOSTS = frozenset({
    "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
    "youtu.be", "www.youtu.be",
    "youtube-nocookie.com", "www.youtube-nocookie.com",
})

#: Path prefixes that carry the id as their next segment: /shorts/<id>,
#: /embed/<id>, /live/<id>, /v/<id>.
_ID_PATH_PREFIXES = frozenset({"shorts", "embed", "live", "v"})

#: A YouTube video id is exactly eleven URL-safe base64 characters.
VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")

OEMBED_ENDPOINT = "https://www.youtube.com/oembed"
THUMBNAIL_HOST = "https://i.ytimg.com/vi"

#: Poster candidates, best first. `oar1`/`oar2` are the vertical (9:16)
#: frames YouTube renders for Shorts — exactly the shape the rail's card is —
#: but only some Shorts have them; `maxresdefault` is the 1280×720 landscape
#: frame (the card crops it to 9:16 with object-cover), and `hqdefault` is the
#: 480×360 frame every video has.
THUMBNAIL_VARIANTS = ("oar1", "oar2", "maxresdefault", "hqdefault")

#: i.ytimg answers a missing variant with HTTP 200 and a 120×90 grey
#: placeholder on some videos rather than a 404, so status alone is not
#: enough — anything narrower than this is that placeholder, not a poster.
MIN_THUMBNAIL_WIDTH = 300

#: What a reel is called when YouTube's oEmbed answer carries no usable
#: title (a private or deleted video, a fetch failure). Deliberately not
#: blank: an empty title cell in the dashboard reads as a rendering failure.
UNTITLED_REEL_TITLE = "ريل بدون عنوان"

#: The model column is varchar(200); Postgres enforces it, SQLite does not,
#: so a long caption is truncated here rather than turned into a 500 on save.
MAX_TITLE_LENGTH = 200

OEMBED_TIMEOUT = 10
IMAGE_TIMEOUT = 15
#: A poster is a few hundred KB; streaming with a budget is what stops a
#: hostile or broken response from filling the disk.
MAX_IMAGE_BYTES = 8 * 1024 * 1024

USER_AGENT = "AlDaftarNews/1.0 (+https://aldaftarnews.com)"


class YouTubeError(Exception):
    """A fetch that could not complete. Always non-fatal to the save."""


def extract_video_id(url: str | None) -> str | None:
    """
    The eleven-character video id out of any of the link shapes YouTube
    hands out, or None if this is not a YouTube video link at all.

        https://www.youtube.com/shorts/<id>
        https://www.youtube.com/watch?v=<id>&t=12
        https://youtu.be/<id>?si=<tracking>
        https://www.youtube.com/embed/<id>
        https://www.youtube.com/live/<id>
        https://m.youtube.com/watch?v=<id>

    Tracking parameters (`si`, `feature`, `t`…) are simply ignored: the id
    is the only thing the rest of the pipeline is built from.
    """
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        return None
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        return None

    segments = [s for s in parsed.path.split("/") if s]
    candidate = ""
    if host in ("youtu.be", "www.youtu.be"):
        candidate = segments[0] if segments else ""
    elif segments and segments[0] in _ID_PATH_PREFIXES:
        candidate = segments[1] if len(segments) > 1 else ""
    else:
        # /watch?v=<id>, and the bare /?v=<id> some share sheets produce.
        candidate = parse_qs(parsed.query).get("v", [""])[0]

    return candidate if VIDEO_ID.match(candidate) else None


def watch_url(video_id: str) -> str:
    """The canonical watch URL — what oEmbed is asked about."""
    return f"https://www.youtube.com/watch?v={video_id}"


def _clean_title(raw: str) -> str:
    # \xa0 shows up in YouTube titles pasted from share sheets; collapse it
    # with ordinary whitespace so it can't survive mid-title.
    collapsed = re.sub(r"[\s\xa0]+", " ", raw).strip()
    return collapsed[:MAX_TITLE_LENGTH]


def fetch_title(video_id: str) -> str | None:
    """
    The video's own title, via oEmbed. None when YouTube has nothing to say
    (private, deleted, or unreachable) — the caller decides what a missing
    title means.
    """
    try:
        response = requests.get(
            OEMBED_ENDPOINT,
            params={"url": watch_url(video_id), "format": "json"},
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            timeout=OEMBED_TIMEOUT,
        )
    except requests.RequestException as exc:
        raise YouTubeError(f"oEmbed unreachable for {video_id}: {exc}") from exc
    if response.status_code != 200:
        raise YouTubeError(f"oEmbed answered HTTP {response.status_code} for {video_id}")
    try:
        title = response.json().get("title")
    except ValueError as exc:
        raise YouTubeError(f"oEmbed answered non-JSON for {video_id}") from exc
    if not title or not isinstance(title, str):
        return None
    return _clean_title(title) or None


def thumbnail_url(video_id: str, variant: str) -> str:
    return f"{THUMBNAIL_HOST}/{video_id}/{variant}.jpg"


def _download_image(url: str) -> bytes:
    """The image's bytes, capped. Raises YouTubeError on anything else."""
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=IMAGE_TIMEOUT, stream=True)
    except requests.RequestException as exc:
        raise YouTubeError(f"could not download {url}: {exc}") from exc
    if response.status_code != 200:
        raise YouTubeError(f"{url} answered HTTP {response.status_code}")

    chunks, total = [], 0
    for chunk in response.iter_content(64 * 1024):
        total += len(chunk)
        if total > MAX_IMAGE_BYTES:
            raise YouTubeError(f"{url} is larger than the size cap")
        chunks.append(chunk)
    if not total:
        raise YouTubeError(f"{url} came back empty")
    return b"".join(chunks)


def _decode_image(raw: bytes) -> tuple[int, int, str] | None:
    """(width, height, extension) if the bytes are a real image, else None."""
    try:
        image = Image.open(io.BytesIO(raw))
        image.verify()
    except (UnidentifiedImageError, OSError):
        return None
    ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(image.format or "")
    if ext is None:
        return None
    return image.size[0], image.size[1], ext


def fetch_thumbnail(video_id: str) -> tuple[bytes, str] | None:
    """
    The best available poster for this video as (bytes, extension), walking
    THUMBNAIL_VARIANTS in order and skipping anything that is not a real
    image of poster size. None when no variant qualifies.
    """
    for variant in THUMBNAIL_VARIANTS:
        url = thumbnail_url(video_id, variant)
        try:
            raw = _download_image(url)
        except YouTubeError as exc:
            log.debug("reel poster %s: %s", variant, exc)
            continue
        decoded = _decode_image(raw)
        if decoded is None:
            continue
        width, _height, ext = decoded
        if width < MIN_THUMBNAIL_WIDTH:
            continue
        return raw, ext
    return None


def attach_scraped_metadata(reel, *, want_title: bool = True, want_image: bool = True, save: bool = True) -> tuple[bool, bool]:
    """
    Give `reel` the title and/or poster YouTube advertises for its video.

    Returns `(title_set, image_set)`. Never raises: a reel whose video cannot
    be read is still a reel the newsroom meant to publish, so a private video
    or a YouTube outage must not fail the save that created it. The caller
    (ReelSerializer._finalize) is what turns a still-blank title into
    UNTITLED_REEL_TITLE — that fallback belongs to the save, not the scrape,
    so a caller that only wants the picture (the thumbnail backfill command)
    is never handed a title it did not ask for.
    """
    video_id = reel.youtube_id or extract_video_id(reel.url)
    if not video_id or not (want_title or want_image):
        return False, False

    title_set = False
    if want_title:
        try:
            title = fetch_title(video_id)
        except YouTubeError as exc:
            log.warning("reel %s: title fetch failed — %s", reel.pk or "(new)", exc)
            title = None
        except Exception:  # noqa: BLE001 - a scrape must never break a save
            log.exception("reel %s: unexpected error fetching the title", reel.pk or "(new)")
            title = None
        if title:
            reel.title = title
            title_set = True

    image_set = False
    if want_image:
        try:
            found = fetch_thumbnail(video_id)
        except Exception:  # noqa: BLE001 - a scrape must never break a save
            log.exception("reel %s: unexpected error fetching the poster", reel.pk or "(new)")
            found = None
        if found:
            content, ext = found
            reel.thumbnail.save(f"{video_id}.{ext}", ContentFile(content), save=False)
            image_set = True
        else:
            log.warning("reel %s: no poster fetched for %s", reel.pk or "(new)", video_id)

    if save and (title_set or image_set):
        reel.save()
    return title_set, image_set
