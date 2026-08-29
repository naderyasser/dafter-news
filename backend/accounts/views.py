from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Article
from content.serializers import ArticleCardSerializer

from aldaftar.permissions import AdminOnly, IsSelf, ReadOnlyOrEditor
from .models import Follow, SavedArticle, User
from .serializers import (
    AuthorSerializer,
    FollowSerializer,
    SavedArticleSerializer,
    UserCreateSerializer,
    UserSerializer,
)


class AuthorViewSet(viewsets.ModelViewSet):
    """
    /api/authors/ — بالعقل والمنطق writers + bylines.

    Reads are public; writes are staff-only via ReadOnlyOrStaff, which is what
    lets the dashboard panel add, rename, re-photograph, hide and delete a
    columnist. Hidden authors stay in the staff listing (that's how you unhide
    one) but drop out of the public one.
    """

    serializer_class = AuthorSerializer
    # Editor+, not any staff: this panel creates, renames, re-photographs and
    # hides the paper's bylines. A كاتب editing the masthead — including their
    # own listing — is the same class of change as editing the section list.
    permission_classes = [ReadOnlyOrEditor]
    lookup_field = "username"
    # DRF's default lookup regex excludes '.' (reserved for format suffixes
    # like .json) — usernames here are dotted (e.g. "m.eladawy"), so widen it.
    lookup_value_regex = r"[^/]+"

    def get_queryset(self):
        qs = User.objects.filter(role__in=[User.Role.AUTHOR, User.Role.EDITOR]).order_by("first_name")
        user = self.request.user
        if not (user.is_authenticated and (user.is_staff or user.is_superuser)):
            qs = qs.filter(is_hidden=False)
        return qs


class UserViewSet(viewsets.ModelViewSet):
    """/api/users/ — DashUsers.dc.html (المستخدمون والأدوار)."""

    queryset = User.objects.all().order_by("-date_joined")
    permission_classes = [AdminOnly]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def perform_destroy(self, instance):
        """
        Offboarding without erasing the archive.

        Article.author is on_delete=SET_NULL, so deleting an account has never
        deleted their stories — but it did quietly strip the credit off every
        one of them, because the byline is read from that FK. A story that was
        written by someone still needs to say so after they leave.

        So each of their articles keeps the name in `byline`, the manual
        credit field the editor already uses for guest contributors, which
        takes priority over the FK everywhere it is read (see
        ArticleCardSerializer.get_author_name). Only articles with no manual
        byline of their own are stamped: an existing one was a deliberate
        override and outranks the account anyway.

        Deactivating (is_active=False) is the better move and is what the
        dashboard offers first — the account stops being able to log in while
        every link, byline and author page keeps working. This path is for
        when an admin genuinely wants the account gone.
        """
        credit = instance.display_name
        if credit:
            instance.articles.filter(byline="").update(byline=credit)
        super().perform_destroy(instance)

    def destroy(self, request, *args, **kwargs):
        """An admin cannot delete themselves — that is how a newsroom ends up
        with no way back into its own dashboard."""
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {"detail": "لا يمكنك حذف حسابك الخاص. اطلب من مدير آخر القيام بذلك."},
                status=status.HTTP_409_CONFLICT,
            )
        return super().destroy(request, *args, **kwargs)


class FollowViewSet(viewsets.ModelViewSet):
    """/api/follows/ — the caller's own follows, never anyone else's."""

    serializer_class = FollowSerializer
    permission_classes = [IsSelf]

    def get_queryset(self):
        return (
            Follow.objects.filter(user=self.request.user)
            .select_related("section", "author")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedArticleViewSet(viewsets.ModelViewSet):
    """/api/saved/ — «اقرأ لاحقاً»."""

    serializer_class = SavedArticleSerializer
    permission_classes = [IsSelf]

    def get_queryset(self):
        return SavedArticle.objects.filter(user=self.request.user).select_related("article")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MyFeedView(APIView):
    """
    /api/my-feed/ — published articles from the sections and bylines the
    caller follows. Falls back to nothing rather than to "everything": an
    empty personalised feed should invite a follow, not look like the
    homepage.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        follows = Follow.objects.filter(user=request.user)
        section_ids = [f.section_id for f in follows if f.section_id]
        author_ids = [f.author_id for f in follows if f.author_id]

        if not section_ids and not author_ids:
            return Response({"count": 0, "results": [], "following": 0})

        qs = (
            Article.objects.filter(status="published")
            .filter(Q(section_id__in=section_ids) | Q(author_id__in=author_ids))
            .select_related("section", "author")
            .annotate(comment_count=Count("comments", distinct=True))
            # ArticleCardSerializer.get_excerpt reads the blocks; prefetching
            # keeps that one query for the page instead of one per card.
            .prefetch_related("blocks")
            .order_by("-published_at", "-pk")[:30]
        )
        return Response({
            "count": qs.count(),
            "following": len(section_ids) + len(author_ids),
            "results": ArticleCardSerializer(qs, many=True, context={"request": request}).data,
        })
