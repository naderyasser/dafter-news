from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from aldaftar.permissions import PublicSubmission, ReadOnlyOrStaff, StaffOnly
from aldaftar.mixins import SlugOrPkLookupMixin

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
    filterset_fields = ["status", "kind", "language", "section__key", "badge", "tags__slug"]
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
        qs = super().get_queryset()
        if self.action == "list" and "status" not in self.request.query_params:
            qs = qs.filter(status=Article.Status.PUBLISHED)
        return qs


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
        from siteconfig.models import DailyVisit
        from video.models import Video

        today = timezone.localdate()
        visits_today = DailyVisit.objects.filter(date=today).first()
        published_count = Article.objects.filter(status=Article.Status.PUBLISHED).count()
        pending_comments = Comment.objects.filter(status=Comment.Status.PENDING).count()
        video_views = Video.objects.aggregate(total=Sum("views"))["total"] or 0

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
            "stats": {
                "visits_today": visits_today.visits if visits_today else 0,
                "visits_change_pct": visits_today.change_pct if visits_today else 0,
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
