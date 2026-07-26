"""
Shared HTTP plumbing for every external feed.

Two rules the whole integration layer is built on:

1. A provider NEVER raises into the caller. `fetch_json` returns None on any
   failure, so a dead upstream can't take a page down with it.
2. A provider NEVER deletes or blanks existing rows. Every sync updates in
   place, which means a bad response leaves yesterday's prices on screen
   instead of an empty ticker. SyncLog is what tells you the difference.
"""
import logging

import requests

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 8
USER_AGENT = "AlDaftarNews/1.0 (+https://aldaftarnews.com)"


class ProviderError(Exception):
    """Raised inside a provider to signal a usable-but-wrong response.

    Network faults are handled by fetch_json; this is for the case where the
    request succeeded but the payload isn't what we asked for (an error
    object, a missing field, an empty result set)."""


def fetch_json(url, params=None, headers=None, timeout=DEFAULT_TIMEOUT):
    """
    GET a JSON document, or None if anything at all goes wrong.

    Deliberately swallows every exception: these run on a one-minute cron
    against half a dozen third parties, and any of them can be down, slow,
    rate-limited, or briefly serving HTML. None means "no update this run",
    which the callers treat as "keep what we have".
    """
    merged = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        merged.update(headers)
    try:
        res = requests.get(url, params=params, headers=merged, timeout=timeout)
        if res.status_code != 200:
            logger.warning("feed %s returned HTTP %s", url, res.status_code)
            return None
        return res.json()
    except requests.exceptions.Timeout:
        logger.warning("feed %s timed out after %ss", url, timeout)
        return None
    except requests.exceptions.RequestException as exc:
        logger.warning("feed %s failed: %s", url, exc)
        return None
    except ValueError:
        # 200 with a non-JSON body — usually an upstream error page.
        logger.warning("feed %s returned non-JSON", url)
        return None


def push_series(existing, value, cap=8):
    """
    Append a reading to a sparkline series, keeping the last `cap` points.

    Guards the shape as well as the length: `series` is a JSONField, so a bad
    write upstream could leave a string or a dict in there, and the chart
    would break at render time rather than here.
    """
    series = existing if isinstance(existing, list) else []
    numeric = [v for v in series if isinstance(v, (int, float))]
    numeric.append(round(float(value), 2))
    return numeric[-cap:]


def pct_change(previous, current):
    """Percentage move between two readings, 0 when there's no baseline."""
    try:
        previous = float(previous)
        current = float(current)
    except (TypeError, ValueError):
        return 0.0
    if not previous:
        return 0.0
    return round(((current - previous) / previous) * 100, 2)
