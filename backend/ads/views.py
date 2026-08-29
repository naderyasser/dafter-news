from rest_framework import viewsets

from aldaftar.permissions import EditorOrAdmin
from .models import AdPlacement
from .serializers import AdPlacementSerializer


class AdPlacementViewSet(viewsets.ModelViewSet):
    # Impressions/clicks/CTR are internal monetization figures — unlike
    # currencies/weather/prayer times there is no public page that renders
    # them, so (unlike most newsroom content) even GET is staff-only.
    queryset = AdPlacement.objects.all()
    serializer_class = AdPlacementSerializer
    permission_classes = [EditorOrAdmin]
