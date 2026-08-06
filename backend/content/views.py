import logging

from django.core.files.base import ContentFile
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from aldaftar.permissions import PublicSubmission, ReadOnlyOrStaff, StaffOnly
from aldaftar.mixins import SlugOrPkLookupMixin

from . import import_url
from .models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag
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


class StoryViewSet(viewsets.ModelViewSet):
    """The homepage stories rail — curated promo cards, editor-ordered."""

    queryset = Story.objects.select_related("section")
    serializer_class = StorySerializer
    permission_classes = [ReadOnlyOrStaff]
    filterset_fields = ["active", "section__key"]
    ordering_fields = ["order"]


class SectionViewSet(viewsets.ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [ReadOnlyOrStaff]
    lookup_field = "key"
    ordering_fields = ["order"]


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [ReadOnlyOrStaff]
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
        .annotate(comment_count=Count("comments", distinct=True))
        .order_by("-published_at", "-created_at", "-pk")
    )
    permission_classes = [ReadOnlyOrStaff]
    # author__username lets the author bio page ask the API for "this
    # author's articles" directly. Before this, app/authors/[username]/page.tsx
    # worked around the missing filter by fetching the site's 12 most recent
    # articles and filtering them client-side by author_username — so any
    # author whose latest piece wasn't in that global top-12 got an empty
    # "مقالات الكاتب" block despite article_count showing a nonzero total.
    filterset_fields = ["status", "kind", "language", "section__key", "badge", "tags__slug", "pinned", "author__username"]
    search_fields = ["title", "standfirst"]
    ordering_fields = ["published_at", "views", "created_at", "comment_count"]
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
        return qs

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
            .annotate(comment_count=Count("comments", distinct=True))
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
    permission_classes = [ReadOnlyOrStaff]
    filterset_fields = ["active"]
    ordering_fields = ["order", "created_at"]


class DashboardOverviewView(APIView):
    """
    /api/dashboard/overview/ — everything DashOverview.dc.html renders:
    the 4 stat cards, the 7-day visits chart, the latest-articles table
    and the review queue.
    """

    permission_classes = [StaffOnly]

    def get(self, request):
        import datetime

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
        yesterday = DailyVisit.objects.filter(date=today - datetime.timedelta(days=1)).first()
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


logger = logging.getLogger(__name__)


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
