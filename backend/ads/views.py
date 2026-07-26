from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import AdPlacement
from .serializers import AdPlacementSerializer


class AdPlacementViewSet(viewsets.ModelViewSet):
    queryset = AdPlacement.objects.all()
    serializer_class = AdPlacementSerializer
    permission_classes = [AllowAny]
