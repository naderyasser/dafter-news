from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import MediaAsset
from .serializers import MediaAssetSerializer


class MediaAssetViewSet(viewsets.ModelViewSet):
    queryset = MediaAsset.objects.all()
    serializer_class = MediaAssetSerializer
    permission_classes = [AllowAny]
    search_fields = ["alt", "credit"]
