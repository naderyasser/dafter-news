from rest_framework import viewsets

from aldaftar.permissions import ReadOnlyOrStaff
from .models import LiveStream, LiveUpdate
from .serializers import LiveStreamSerializer, LiveUpdateSerializer


class LiveStreamViewSet(viewsets.ModelViewSet):
    queryset = LiveStream.objects.prefetch_related("updates")
    serializer_class = LiveStreamSerializer
    permission_classes = [ReadOnlyOrStaff]


class LiveUpdateViewSet(viewsets.ModelViewSet):
    queryset = LiveUpdate.objects.select_related("stream")
    serializer_class = LiveUpdateSerializer
    permission_classes = [ReadOnlyOrStaff]
    filterset_fields = ["stream"]
