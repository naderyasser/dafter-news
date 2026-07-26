from rest_framework import viewsets

from aldaftar.permissions import ReadOnlyOrStaff
from .models import AdPlacement
from .serializers import AdPlacementSerializer


class AdPlacementViewSet(viewsets.ModelViewSet):
    queryset = AdPlacement.objects.all()
    serializer_class = AdPlacementSerializer
    permission_classes = [ReadOnlyOrStaff]
