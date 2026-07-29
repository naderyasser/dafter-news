from rest_framework import viewsets

from aldaftar.permissions import StaffOnly
from .models import MediaAsset
from .serializers import MediaAssetSerializer


class MediaAssetViewSet(viewsets.ModelViewSet):
    # select_related so the grid's per-tile article link doesn't fire a query
    # per row.
    queryset = MediaAsset.objects.select_related("article").all()
    serializer_class = MediaAssetSerializer
    # StaffOnly, not ReadOnlyOrStaff. Nothing public reads this endpoint —
    # getMediaAssets() is called from DashMedia and MediaLibraryPicker and
    # nowhere else — while the serializer hands out article_title and
    # article_slug for whatever an asset is attached to, with no regard for
    # that article's status. So the moment an editor files a photo against a
    # draft, an anonymous GET /api/media/ would name an unpublished story and
    # give away its slug, which is the same leak that was closed on
    # /api/articles/. The images themselves stay public at /media/…; it is the
    # library index, its credits and its links that are newsroom-only.
    permission_classes = [StaffOnly]
    # Drives the library's search box (?search=…) — SearchFilter is on by
    # default in REST_FRAMEWORK, so listing the columns here is all it takes.
    search_fields = ["title", "alt", "credit", "source", "article__title"]
    filterset_fields = ["license", "article"]
