from rest_framework.routers import DefaultRouter

from .views import ReelViewSet, VideoCommentViewSet, VideoViewSet

router = DefaultRouter()
router.register("videos", VideoViewSet, basename="video")
router.register("reels", ReelViewSet, basename="reel")
router.register("video-comments", VideoCommentViewSet, basename="video-comment")

urlpatterns = router.urls
