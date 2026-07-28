"""
Web Push delivery for breaking news.

Breaking alerts are what bring a news reader back, and «عاجل» already has a
model and a dashboard screen — this is the transport.

VAPID keys live in the environment. Without them the endpoints answer 503
rather than pretending to subscribe: a reader who taps "enable alerts" and
gets a silent no-op is worse than one who is told the feature is off.
"""

import json
import logging
import os

from django.utils import timezone
from pywebpush import WebPushException, webpush
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from aldaftar.permissions import StaffOnly

from .models import PushSubscription

logger = logging.getLogger(__name__)

VAPID_PUBLIC = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:admin@dafter.educore.software")

# Chrome drops a subscription after ~4 consecutive failures; prune at that point.
MAX_FAILURES = 4


def _record_failure(sub):
    """
    Bump a subscription's failure streak, pruning it once it crosses
    MAX_FAILURES. Shared by every non-success path in send_to_all() so a
    delivery failure that *isn't* a WebPushException with a bad status code
    (a timeout, connection error, SSL error, or anything else the underlying
    `requests` call can raise) is still counted and eventually pruned instead
    of leaving a permanently-broken subscription invisible forever.

    Returns True if the subscription was pruned.
    """
    count = sub.failure_count + 1
    if count >= MAX_FAILURES:
        sub.delete()
        return True
    PushSubscription.objects.filter(pk=sub.pk).update(failure_count=count)
    return False


def configured():
    return bool(VAPID_PUBLIC and VAPID_PRIVATE)


@api_view(["GET"])
@permission_classes([AllowAny])
def vapid_public_key(request):
    if not configured():
        return Response({"detail": "التنبيهات غير مفعّلة على هذا الخادم."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    return Response({"publicKey": VAPID_PUBLIC})


@api_view(["POST"])
@permission_classes([AllowAny])
def subscribe(request):
    if not configured():
        return Response({"detail": "التنبيهات غير مفعّلة على هذا الخادم."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    endpoint = (request.data.get("endpoint") or "").strip()
    keys = request.data.get("keys") or {}
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if not endpoint or not p256dh or not auth:
        return Response({"detail": "اشتراك غير مكتمل."}, status=status.HTTP_400_BAD_REQUEST)

    sub, created = PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={
            "p256dh": p256dh,
            "auth": auth,
            "user": request.user if request.user.is_authenticated else None,
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300],
            "failure_count": 0,
        },
    )
    return Response({"id": sub.id, "created": created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([AllowAny])
def unsubscribe(request):
    endpoint = (request.data.get("endpoint") or "").strip()
    deleted, _ = PushSubscription.objects.filter(endpoint=endpoint).delete()
    return Response({"deleted": deleted}, status=status.HTTP_200_OK)


def send_to_all(title, body, url="/", tag="breaking"):
    """
    Fan out one alert. Returns (sent, failed, pruned).

    A 404/410 from the push service means the browser threw the subscription
    away; that row is dead and is deleted rather than retried forever.
    """
    if not configured():
        return 0, 0, 0

    payload = json.dumps({"title": title, "body": body, "url": url, "tag": tag})
    sent = failed = pruned = 0
    now = timezone.now()

    for sub in PushSubscription.objects.all():
        try:
            webpush(
                subscription_info=sub.as_push_info(),
                data=payload,
                vapid_private_key=VAPID_PRIVATE,
                vapid_claims={"sub": VAPID_SUBJECT},
                timeout=10,
            )
            sent += 1
            PushSubscription.objects.filter(pk=sub.pk).update(last_sent_at=now, failure_count=0)
        except WebPushException as exc:
            code = getattr(exc.response, "status_code", None)
            if code in (404, 410):
                sub.delete()
                pruned += 1
            else:
                failed += 1
                if _record_failure(sub):
                    pruned += 1
        except Exception:  # noqa: BLE001 — one bad endpoint must not stop the fan-out
            # Anything other than WebPushException (timeout, connection
            # error, ...) used to be swallowed here with no counting and no
            # logging — a systematically broken subscription, or a wider
            # environment issue, never got pruned and produced zero
            # operational signal. Log it and count it exactly like a bad
            # response status.
            logger.exception("push delivery failed for subscription %s", sub.pk)
            failed += 1
            if _record_failure(sub):
                pruned += 1

    return sent, failed, pruned


@api_view(["POST"])
@permission_classes([StaffOnly])
def broadcast(request):
    """Dashboard action: push an alert to every subscribed browser."""
    if not configured():
        return Response({"detail": "التنبيهات غير مفعّلة على هذا الخادم."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    title = (request.data.get("title") or "عاجل").strip()
    body = (request.data.get("body") or "").strip()
    url = request.data.get("url") or "/"
    if not body:
        return Response({"body": ["اكتب نص التنبيه."]}, status=status.HTTP_400_BAD_REQUEST)

    sent, failed, pruned = send_to_all(title, body, url)
    return Response({"sent": sent, "failed": failed, "pruned": pruned, "subscribers": PushSubscription.objects.count()})


@api_view(["GET"])
@permission_classes([StaffOnly])
def push_status(request):
    return Response({
        "configured": configured(),
        "subscribers": PushSubscription.objects.count(),
    })
