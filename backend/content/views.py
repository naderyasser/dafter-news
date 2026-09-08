import logging
from datetime import timedelta

from django.core.files.base import ContentFile
from django.db.models import Count, DurationField, ExpressionWrapper, F, FloatField, Q, Sum, Value
from django.db.models.functions import Coalesce, Extract, Greatest
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView

from aldaftar.filters import StableOrderingFilter
from aldaftar.permissions import PublicSubmission, ReadOnlyOrEditor, ReadOnlyOrStaff, StaffOnly
from aldaftar.mixins import SlugOrPkLookupMixin

from . import import_url
from .filters import ArticleFilterSet
from .models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag
from .tts import TtsError, generate_for_article
from .serializers import (
    ArticleCardSerializer,
    ArticleDetailSerializer,
    ArticleWriteSerializer,
    BreakingNewsItemSerializer,
    CommentSerializer,
    SectionSerializer,
    StorySerializer,
    TagSerializer,
)


#: The comment tally every public surface prints — «الأكثر تعليقاً» on the home
#: page, the count on a section card.
#:
#: Approved rows only. A plain Count("comments") also counts what is still
#: sitting in the moderation queue and what a moderator has banned, so a story
#: whose only comments are unpublished spam advertised a discussion no reader
#: could find — and, once «الأكثر تعليقاً» began filtering on this count
#: (see ArticleFilterSet.has_comments), that story would have led the tab.
#:
#: `distinct=True` stays: the article queryset joins tags and blocks, and
#: without it those joins multiply the comment rows.
APPROVED_COMMENTS = Count(
    "comments",
    filter=Q(comments__status=Comment.Status.APPROVED),
    distinct=True,
)


class ArticleViewRateThrottle(SimpleRateThrottle):
    """
    Rate limit for the per-article read beacon, keyed on the caller's IP.

    A scope of its own rather than reusing "visits": that one is per browser
    session, this one fires per article, so a reader working through a dozen
    stories is normal traffic here and would look like abuse there. Rate
    lives in settings.DEFAULT_THROTTLE_RATES["article_views"].

    A plain SimpleRateThrottle subclass rather than ScopedRateThrottle with
    `throttle_scope` on the @action: DRF validates an action's extra kwargs
    against the viewset's own attributes and rejects `throttle_scope`, which
    APIView doesn't declare.
    """

    scope = "article_views"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class StoryViewSet(viewsets.ModelViewSet):
    """The homepage stories rail — curated promo cards, editor-ordered."""

    queryset = Story.objects.select_related("section")
    serializer_class = StorySerializer
    permission_classes = [ReadOnlyOrEditor]
    filterset_fields = ["active", "section__key"]
    # `created_at` is here so the rail can ask for newest-first. DRF's
    # OrderingFilter validates `?ordering=` against this list and silently
    # DROPS anything missing from it — falling back to Meta.ordering with no
    # error — so a caller asking for `-created_at` while this said ["order"]
    # got the default sort and no indication that its request was ignored.
    ordering_fields = ["order", "created_at"]


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [ReadOnlyOrEditor]
    lookup_field = "key"
    ordering_fields = ["order"]


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [ReadOnlyOrEditor]
    lookup_field = "slug"


class ArticleViewSet(SlugOrPkLookupMixin, viewsets.ModelViewSet):
    """
    /api/articles/ — powers Home/Section/Tag/Search grids (public, published
    only unless ?status= is passed) and DashArticles.dc.html (all statuses).
    """

    # NB: annotate() drops Meta.ordering, which leaves the paginator with an
    # unordered queryset — rows can then repeat or vanish between pages. Re-
    # apply the ordering explicitly, with pk last as a stable tie-breaker
    # (published_at is NULL for drafts, so it can't disambiguate on its own).
    queryset = (
        Article.objects.select_related("section", "author")
        .prefetch_related("tags", "blocks")
        .annotate(comment_count=APPROVED_COMMENTS)
        .order_by("-published_at", "-created_at", "-pk")
    )
    permission_classes = [ReadOnlyOrStaff]
    # author__username lets the author bio page ask the API for "this
    # author's articles" directly. Before this, app/authors/[username]/page.tsx
    # worked around the missing filter by fetching the site's 12 most recent
    # articles and filtering them client-side by author_username — so any
    # author whose latest piece wasn't in that global top-12 got an empty
    # "مقالات الكاتب" block despite article_count showing a nonzero total.
    # Now a FilterSet rather than a field list, so it can carry
    # `published_within` too — see content/filters.py.
    filterset_class = ArticleFilterSet
    search_fields = ["title", "standfirst"]
    ordering_fields = ["published_at", "views", "created_at", "comment_count", "pinned", "trending_score"]
    # Ordering goes through StableOrderingFilter so `?ordering=-views` can't
    # return tied rows in a different order every query — see aldaftar/filters.py.
    filter_backends = [DjangoFilterBackend, SearchFilter, StableOrderingFilter]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action in ("list",):
            return ArticleCardSerializer
        if self.action in ("create", "update", "partial_update"):
            return ArticleWriteSerializer
        return ArticleDetailSerializer

    def get_queryset(self):
        """
        Non-staff callers only ever see published articles.

        This used to gate on `self.action == "list"`, which left `retrieve`
        (and therefore SlugOrPkLookupMixin.get_object, used by every detail
        route) completely unfiltered — an anonymous GET on a draft/review/
        scheduled article's slug or id returned the full body. The list-time
        filter was also only an *opt-out*: any `?status=` value at all (not
        just a staff-intended one) skipped it, since django-filter applies
        the `status` filterset field afterwards regardless. Scope the
        published-only restriction to the caller's staff status instead, on
        every action, and let staff keep using `?status=` to pick a status.
        """
        qs = super().get_queryset()
        user = self.request.user
        is_staff = user.is_authenticated and (user.is_staff or user.is_superuser)
        if not is_staff:
            qs = qs.filter(status=Article.Status.PUBLISHED)
        return qs.annotate(**self._trending_annotations())

    @staticmethod
    def _trending_annotations():
        """
        `?ordering=-trending_score` — «الأكثر قراءة», ranked by what's being
        read *now* rather than by lifetime total.

        `views ÷ hours_since_published` decays a steady, months-old
        accumulator toward the noise floor once it stops earning new reads,
        while a handful of reads in a fresh article's first hour still beats
        it — which is the point of a trending list. Computed fresh on every
        request (never on the class-level `queryset`, which is built once at
        import time and would freeze "now" at server start) so a long-lived
        worker never serves a stale score.
        On its own this formula is NOT enough, though: a lifetime accumulator
        only fully decays after it stops gaining reads, so an old story that
        is still steadily read (or — as every row in this seed data is —
        carries a large one-time seeded view count) keeps a high score
        indefinitely. The frontend pairs this ordering with a short
        `published_within` window (see lib/api.ts's getMostRead) so the
        ranking only ever competes among genuinely recent stories in the
        first place; the decay is what orders *within* that window.
        `Greatest(hours, 1.0)` floors the divisor at one hour so a story
        published a minute ago with a single read doesn't divide by
        near-zero and rocket to the top on one click. `Coalesce` guards a
        NULL `published_at` — unreachable from a public request (those are
        always status=PUBLISHED, which Article.save() never leaves without
        a stamped published_at) but reachable from a staff-authenticated
        one listing drafts, where a NULL would otherwise poison the sort
        instead of just scoring that row at 0.
        """
        now = timezone.now()
        age = ExpressionWrapper(Value(now) - Coalesce(F("published_at"), Value(now)), output_field=DurationField())
        hours_since_published = ExpressionWrapper(Extract(age, "epoch") / 3600.0, output_field=FloatField())
        return {
            "hours_since_published": hours_since_published,
            "trending_score": ExpressionWrapper(
                F("views") / Greatest(F("hours_since_published"), 1.0), output_field=FloatField()
            ),
        }

    @action(detail=True, methods=["get"])
    def related(self, request, slug=None):
        """
        /api/articles/<slug>/related/ — the stories most related to this one,
        by shared tags first (the tags carry the people and topics, so «السيسي»
        or «أسعار الفائدة» pulls that person's or subject's earlier coverage),
        topped up with the section's latest so the box is never empty.
        """
        article = self.get_object()
        limit = 6
        base = (
            Article.objects.filter(
                status=Article.Status.PUBLISHED, kind=article.kind, language=article.language
            )
            .exclude(pk=article.pk)
            .select_related("section", "author")
            # Mirror ArticleViewSet.queryset's annotation — without it,
            # ArticleCardSerializer.comment_count has nothing to read and
            # silently falls back to its default of 0 for every card here.
            .annotate(comment_count=APPROVED_COMMENTS)
            # ...and its blocks prefetch, which get_excerpt reads: without it
            # every card in this box costs its own query for the paragraph.
            .prefetch_related("blocks")
        )

        tag_ids = list(article.tags.values_list("id", flat=True))
        picked = []
        if tag_ids:
            picked = list(
                base.filter(tags__in=tag_ids)
                .annotate(shared=Count("tags", filter=Q(tags__in=tag_ids), distinct=True))
                .order_by("-shared", "-published_at", "-pk")
                .distinct()[:limit]
            )
        if len(picked) < limit and article.section_id:
            extra = (
                base.filter(section_id=article.section_id)
                .exclude(pk__in=[a.pk for a in picked])
                .order_by("-published_at", "-pk")[: limit - len(picked)]
            )
            picked += list(extra)

        data = ArticleCardSerializer(picked, many=True, context=self.get_serializer_context()).data
        return Response({"count": len(data), "results": data})

    @action(
        detail=True,
        methods=["post"],
        url_path="track-view",
        permission_classes=[AllowAny],
        # Same posture as siteconfig's VisitTrackView, and for the same
        # reason: with Session auth in the list, a signed-in editor reading
        # the public site would fail CSRF here and silently drop out of the
        # count. The view reads nothing from the caller and echoes nothing
        # back, so there is nothing for CSRF to protect.
        authentication_classes=[],
        throttle_classes=[ArticleViewRateThrottle],
    )
    def track_view(self, request, slug=None):
        """
        POST /api/articles/<slug>/track-view/ — the writer `views` never had.

        Nothing in this codebase has ever incremented Article.views: the only
        values in that column came from seed_demo_data, which is why
        «الأكثر قراءة» was frozen on a handful of three-week-old demo rows
        and a genuinely popular new story could never appear in it however
        much traffic it was sent.

        `F("views") + 1` rather than read-then-save: two readers landing in
        the same millisecond would otherwise both read N and both write N+1,
        and the site would undercount exactly when it is busiest. The update
        also bypasses Article.save(), which is what we want here — a read is
        not an edit, so it must not touch `updated_at` or re-derive a slug.

        get_object() runs the viewset's own published-only scoping for
        anonymous callers, so a draft's URL cannot be used to farm views on
        something that isn't public yet.
        """
        article = self.get_object()
        Article.objects.filter(pk=article.pk).update(views=F("views") + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], permission_classes=[StaffOnly])
    def generate_tts(self, request, slug=None):
        """
        /api/articles/<slug>/generate_tts/ — the dashboard's «توليد النسخة
        الصوتية» button. Was previously a `setTimeout` in the editor that
        flipped a status flag with nothing behind it — «استمع للمقال» never
        had real audio to play. Runs synchronously (a few seconds for a
        typical article) rather than queuing a job, so the editor's spinner
        resolves to a real result in one request.
        """
        article = self.get_object()
        try:
            seconds = generate_for_article(article)
        except TtsError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        return Response(
            {
                "tts_status": article.tts_status,
                "tts_audio": article.tts_audio.url if article.tts_audio else None,
                "tts_duration_seconds": seconds,
            }
        )


class CommentViewSet(viewsets.ModelViewSet):
    """DashComments.dc.html moderation queue."""

    queryset = Comment.objects.select_related("article")
    serializer_class = CommentSerializer
    permission_classes = [PublicSubmission]
    filterset_fields = ["status", "article"]

    def perform_create(self, serializer):
        """
        A reader may submit, never publish.

        `status` is a writable field on the serializer because moderators set
        it from the queue — but it arrives from the public form too, and a
        POST carrying status="approved" went straight to the site without ever
        being seen. Anything from a non-staff caller is pinned to pending.
        """
        user = self.request.user
        is_staff = user.is_authenticated and (user.is_staff or user.is_superuser)
        if is_staff:
            serializer.save()
        else:
            serializer.save(status=Comment.Status.PENDING)


class BreakingNewsItemViewSet(viewsets.ModelViewSet):
    """DashBreaking.dc.html + the marquee strip in SiteHeader."""

    queryset = BreakingNewsItem.objects.all()
    serializer_class = BreakingNewsItemSerializer
    permission_classes = [ReadOnlyOrEditor]
    filterset_fields = ["active"]
    ordering_fields = ["order", "created_at"]


class UrgentNotificationView(APIView):
    """
    /api/urgent-notification/ — the single floating popup shown on every
    public page (SiteFooter mounts it, per the client's brief).

    No stored "currently active" record to manage: the newest published,
    notify_urgent article within the last 24h simply *is* the active one, so
    a fresher urgent story overrides an older one for free — there is
    nothing to unset. An article un-published or older than 24h just stops
    matching the query, rather than needing a background job to expire it.
    """

    permission_classes = [ReadOnlyOrStaff]

    def get(self, request):
        lang = request.query_params.get("language", "ar")
        cutoff = timezone.now() - timedelta(hours=24)
        article = (
            Article.objects.filter(
                status=Article.Status.PUBLISHED,
                language=lang,
                notify_urgent=True,
                published_at__gte=cutoff,
            )
            .order_by("-published_at")
            .first()
        )
        if not article:
            # Not `Response(None)` — DRF's JSONRenderer special-cases `None`
            # into a genuinely empty body with no Content-Type at all, which
            # breaks `res.json()` on the client. `{}` is a real, parseable
            # JSON value; the frontend treats a response with no `id` as
            # "nothing to show".
            return Response({})
        return Response(
            {
                "id": article.id,
                "title": article.title,
                "label": article.notify_label or "خبر عاجل",
                "href": f"/article/{article.slug}" if lang == "ar" else f"/en/article/{article.slug}",
                "cover_image": article.cover_image.url if article.cover_image else None,
                "published_at": article.published_at,
            }
        )


class DashboardOverviewView(APIView):
    """
    /api/dashboard/overview/ — everything DashOverview.dc.html renders:
    the 4 stat cards, the 7-day visits chart, the latest-articles table
    and the review queue.
    """

    permission_classes = [StaffOnly]

    def get(self, request):
        from integrations.models import SyncLog
        from siteconfig.models import DailyVisit
        from video.models import Video

        today = timezone.localdate()
        visits_today = DailyVisit.objects.filter(date=today).first()
        published_count = Article.objects.filter(status=Article.Status.PUBLISHED).count()
        pending_comments = Comment.objects.filter(status=Comment.Status.PENDING).count()
        video_views = Video.objects.aggregate(total=Sum("views"))["total"] or 0

        # Now that VisitTrackView makes the counter real, the day-over-day
        # change is computed from the two rows rather than trusted from the
        # stored column — the seed wrote 4.2 there once and nothing updates
        # it. The stored value stays as the fallback for day one, when there
        # is no yesterday to compare against.
        yesterday = DailyVisit.objects.filter(date=today - timedelta(days=1)).first()
        if visits_today and yesterday and yesterday.visits:
            change_pct = round((visits_today.visits - yesterday.visits) / yesterday.visits * 100, 1)
        else:
            change_pct = visits_today.change_pct if visits_today else 0

        # Feeds that have been failing long enough to matter. Three misses is
        # past a blip: the minutely cron means three is three minutes for the
        # fast sources, and the two rows that shipped broken (newswire /
        # weather pre-key) sat at four thousand with nobody told.
        feed_alerts = [
            {
                "source": log.source,
                "label": log.label,
                "consecutive_failures": log.consecutive_failures,
                "last_success_at": log.last_success_at,
                "message": log.message,
            }
            for log in SyncLog.objects.filter(
                status=SyncLog.Status.FAILED, consecutive_failures__gte=3
            ).order_by("-consecutive_failures")
        ]

        last_7 = DailyVisit.objects.order_by("-date")[:7][::-1]
        max_visits = max((d.visits for d in last_7), default=1) or 1
        chart = [
            {
                "label": d.date.strftime("%a"),
                "value": d.visits,
                "bar_pct": round((d.visits / max_visits) * 100),
            }
            for d in last_7
        ]

        recent = Article.objects.select_related("section").order_by("-created_at")[:6]
        queue = Article.objects.filter(status=Article.Status.REVIEW).select_related("author")[:4]

        return Response({
            "feed_alerts": feed_alerts,
            "stats": {
                "visits_today": visits_today.visits if visits_today else 0,
                "visits_change_pct": change_pct,
                "published_articles": published_count,
                "pending_comments": pending_comments,
                "video_views": video_views,
            },
            "chart": chart,
            "recent_articles": [
                {
                    "id": a.id, "title": a.title, "section": a.section.name_ar if a.section else "",
                    "status": a.status, "views": a.views,
                }
                for a in recent
            ],
            "review_queue": [
                {"id": a.id, "title": a.title, "author": a.author.display_name if a.author else "—", "slug": a.slug}
                for a in queue
            ],
        })


class ImportFromUrlView(APIView):
    """
    POST /api/articles/import-from-url/ — «استيراد من رابط».

    Returns a starting draft's fields; it does not create the Article
    itself, so the normal editor save path (draft/review/published) is
    still what actually publishes anything. See content/import_url.py for
    why the source is credited automatically rather than left for someone
    to remember, and for the SSRF guard on the fetch.
    """

    permission_classes = [StaffOnly]

    def post(self, request):
        url = (request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "أدخل رابط الخبر."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            data = import_url.extract_article(url)
        except import_url.ImportError_ as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        cover_asset = None
        if data["image_url"]:
            cover_asset = self._save_cover(data["image_url"], data["title"], data["source_url"], data["source_domain"])

        return Response({
            "title": data["title"],
            "standfirst": data["standfirst"],
            "paragraphs": data["paragraphs"],
            # Visible by default — clearing it is a deliberate edit an
            # editor makes themselves, not something this endpoint does.
            "byline": f"منقول عن {data['source_domain']}" if data["source_domain"] else "",
            "source_url": data["source_url"],
            "cover_asset_id": cover_asset.id if cover_asset else None,
            "cover_image": cover_asset.image.url if cover_asset else None,
            "cover_credit": data["source_domain"],
        })

    @staticmethod
    def _save_cover(image_url, title, source_url, source_domain):
        """Best-effort: a lead image that fails to download or isn't a real
        image must not fail the whole import — the text is still useful
        without it."""
        import io

        from PIL import Image, UnidentifiedImageError

        from media_library.models import MediaAsset

        try:
            raw, _content_type = import_url.fetch_image_bytes(image_url)
        except import_url.ImportError_ as exc:
            logger.warning("import-from-url: cover fetch failed for %s: %s", image_url, exc)
            return None

        # Trust nothing from the Content-Type header alone — verify the
        # bytes actually decode as an image before this ever touches disk.
        try:
            img = Image.open(io.BytesIO(raw))
            img.verify()
            fmt = (img.format or "").lower()
        except (UnidentifiedImageError, OSError):
            logger.warning("import-from-url: downloaded file at %s is not a valid image", image_url)
            return None

        ext = {"jpeg": "jpg", "png": "png", "webp": "webp", "gif": "gif"}.get(fmt)
        if ext is None:
            logger.warning("import-from-url: cover at %s decoded as unsupported format %s", image_url, fmt)
            return None

        asset = MediaAsset(title=title[:200], source=source_url[:200], credit=source_domain[:120], license=MediaAsset.License.UNKNOWN)
        asset.image.save(f"imported.{ext}", ContentFile(raw), save=True)
        return asset
