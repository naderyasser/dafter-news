"""
Telling the Next.js front end that the published site has changed.

The dashboard editor calls its own server action after a save, but three
other paths reach the same rows and never touched Next's cache: the
scheduled publisher on cron, the Django admin, and anything writing to the
API directly. A story published any of those ways stayed invisible until the
page's own TTL expired — the "publishing does not update the home page"
report.

Deliberately best-effort and deliberately quiet on failure. A revalidation
that does not land costs the newsroom a stale page for the length of the
page's own revalidate window; an exception raised here would cost them the
publish itself. The write has already committed by the time we are called,
so there is nothing left to protect by failing loudly.

Called on 127.0.0.1:3300 rather than through the public hostname: nginx
proxies /api/ to Django, and going out through the domain would also mean a
TLS handshake and a round trip through the proxy for a local call.
"""
import logging
import os
import threading

import requests

logger = logging.getLogger(__name__)

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://127.0.0.1:3300")
REVALIDATE_TOKEN = os.environ.get("REVALIDATE_TOKEN", "")
TIMEOUT_SECONDS = 5


def _post() -> None:
    try:
        response = requests.post(
            f"{FRONTEND_ORIGIN}/revalidate",
            headers={"x-revalidate-token": REVALIDATE_TOKEN},
            timeout=TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            logger.warning("revalidate: front end answered %s", response.status_code)
    except requests.RequestException as exc:
        logger.warning("revalidate: could not reach the front end (%s)", exc)


def revalidate_site() -> None:
    """
    Flush the public site's cached renders.

    Fired on a background thread so a publish never waits on the front end:
    the editor's save should not hang because Next is mid-restart.

    NOT a daemon thread, deliberately. A daemon is killed the moment the
    interpreter exits, which is fine under gunicorn (long-lived) and silently
    useless in a short-lived process — `manage.py publish_scheduled` on cron
    would fire the request and exit before it left the socket, so the one
    publish path that has no human watching it would never have revalidated.
    That was the original bug in a new disguise. The 5s timeout bounds how
    long any process can be held at exit.
    """
    if not REVALIDATE_TOKEN:
        # Not configured — the deployment has not opted in. Silent by design:
        # this is the normal state in tests and local runs, and a warning per
        # save would drown the log.
        return
    threading.Thread(target=_post, daemon=False).start()
