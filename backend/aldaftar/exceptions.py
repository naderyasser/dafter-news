"""Project-wide DRF exception handling."""

import logging

from django.db import DataError, IntegrityError
from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger(__name__)


def _is_staff(context):
    request = context.get("request") if context else None
    user = getattr(request, "user", None)
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def exception_handler(exc, context):
    """
    Turn a blocked delete into 409, and a database constraint into 409 with
    something readable — instead of 500 in both cases.

    Article.section is on_delete=PROTECT, so deleting a section that still has
    articles raises ProtectedError. DRF has no rule for that exception, so it
    escaped as an unhandled 500 — the Taxonomy screen showed a server error
    for what is really a normal editorial conflict ("empty the section first").

    IntegrityError/DataError get the same treatment for the same reason. DRF
    renders an unhandled exception as a bare `{"detail": "A server error
    occurred."}`, which describeApiError() has nothing to read, so the editor
    saw only the caller's generic fallback — "تعذّر حفظ الخبر. حاول مرة أخرى."
    — for a failure that had an exact, nameable cause sitting in the server
    log. Whatever slipped past field validation into the database's own
    constraints is a conflict the caller can usually act on, and they cannot
    act on what they are never told.

    The driver's own message rides along under `db_detail` for staff callers
    only: it names constraints and column values, which is precisely what
    makes it useful in the newsroom and precisely why it must not go to an
    anonymous commenter. The full traceback is logged either way — a response
    the caller can read is an addition to the log, not a replacement for it.
    """
    if isinstance(exc, (ProtectedError, RestrictedError)):
        blockers = getattr(exc, "protected_objects", None) or getattr(exc, "restricted_objects", None) or []
        return Response(
            {
                "detail": "لا يمكن الحذف لارتباط هذا العنصر بعناصر أخرى. انقل أو احذف المرتبط أولاً.",
                "blocked_by": [str(o) for o in list(blockers)[:10]],
                "blocked_by_count": len(blockers),
            },
            status=status.HTTP_409_CONFLICT,
        )

    if isinstance(exc, (IntegrityError, DataError)):
        view = context.get("view") if context else None
        logger.exception("Database constraint rejected %s on %s", type(exc).__name__, type(view).__name__)
        body = {
            "detail": (
                "تعارض في قاعدة البيانات منع الحفظ — لم يُحفظ أي شيء. "
                "راجع الوسوم والرابط الدائم ثم حاول مرة أخرى."
            )
        }
        if _is_staff(context):
            body["db_detail"] = " ".join(str(exc).split())[:500]
        return Response(body, status=status.HTTP_409_CONFLICT)

    return drf_exception_handler(exc, context)
