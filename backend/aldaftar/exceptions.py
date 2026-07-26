"""Project-wide DRF exception handling."""

from django.db.models.deletion import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """
    Turn a blocked delete into 409 instead of 500.

    Article.section is on_delete=PROTECT, so deleting a section that still has
    articles raises ProtectedError. DRF has no rule for that exception, so it
    escaped as an unhandled 500 — the Taxonomy screen showed a server error
    for what is really a normal editorial conflict ("empty the section first").
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

    return drf_exception_handler(exc, context)
