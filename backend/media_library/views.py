from rest_framework import viewsets

from aldaftar.permissions import ReadOnlyOrStaff
from .models import MediaAsset
from .serializers import MediaAssetSerializer


class MediaAssetViewSet(viewsets.ModelViewSet):
    # select_related so the grid's per-tile article link doesn't fire a query
    # per row.
    queryset = MediaAsset.objects.select_related("article").all()
    serializer_class = MediaAssetSerializer
    permission_classes = [ReadOnlyOrStaff]
    # Drives the library's search box (?search=…) — SearchFilter is on by
    # default in REST_FRAMEWORK, so listing the columns here is all it takes.
    search_fields = ["title", "alt", "credit", "source", "article__title"]
    filterset_fields = ["license", "article"]
