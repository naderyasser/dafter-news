from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import LiveStream, LiveUpdate
from .serializers import LiveStreamSerializer, LiveUpdateSerializer


class LiveStreamViewSet(viewsets.ModelViewSet):
    queryset = LiveStream.objects.prefetch_related("updates")
    serializer_class = LiveStreamSerializer
    permission_classes = [AllowAny]


class LiveUpdateViewSet(viewsets.ModelViewSet):
    queryset = LiveUpdate.objects.select_related("stream")
    serializer_class = LiveUpdateSerializer
    permission_classes = [AllowAny]
    filterset_fields = ["stream"]
