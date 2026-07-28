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
    filterset_fields = ["video", "status"]

    def perform_create(self, serializer):
        """
        A reader may submit, never publish — mirrors
        content.CommentViewSet.perform_create. `status` is writable so staff
        can moderate from the queue, but anything from a non-staff caller
        (the public form never sends it, but nothing stopped it before) is
        pinned to pending rather than appearing on the video page instantly.
        """
        user = self.request.user
        is_staff = user.is_authenticated and (user.is_staff or user.is_superuser)
        if is_staff:
            serializer.save()
        else:
            serializer.save(status=VideoComment.Status.PENDING)
