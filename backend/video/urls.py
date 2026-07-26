from rest_framework.routers import DefaultRouter

from .views import VideoCommentViewSet, VideoViewSet

router = DefaultRouter()
router.register("videos", VideoViewSet, basename="video")
router.register("video-comments", VideoCommentViewSet, basename="video-comment")

urlpatterns = router.urls
