from rest_framework import viewsets

from aldaftar.permissions import PublicSubmission, ReadOnlyOrStaff
from aldaftar.mixins import SlugOrPkLookupMixin

from .models import Video, VideoComment
from .serializers import VideoCommentSerializer, VideoDetailSerializer, VideoSerializer


class VideoViewSet(SlugOrPkLookupMixin, viewsets.ModelViewSet):
    queryset = Video.objects.select_related("section").prefetch_related("comments")
    permission_classes = [ReadOnlyOrStaff]
    filterset_fields = ["section__key", "is_live", "is_exclusive"]
    search_fields = ["title"]
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "retrieve":
            return VideoDetailSerializer
        return VideoSerializer


class VideoCommentViewSet(viewsets.ModelViewSet):
    queryset = VideoComment.objects.select_related("video")
    serializer_class = VideoCommentSerializer
    permission_classes = [PublicSubmission]
    filterset_fields = ["video"]
