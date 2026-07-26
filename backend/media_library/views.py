from rest_framework import viewsets

from aldaftar.permissions import ReadOnlyOrStaff
from .models import MediaAsset
from .serializers import MediaAssetSerializer


class MediaAssetViewSet(viewsets.ModelViewSet):
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    permission_classes = [ReadOnlyOrStaff]
    search_fields = ["alt", "credit"]
