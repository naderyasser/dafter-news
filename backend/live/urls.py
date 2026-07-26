from rest_framework.routers import DefaultRouter

from .views import LiveStreamViewSet, LiveUpdateViewSet

router = DefaultRouter()
router.register("live-streams", LiveStreamViewSet, basename="live-stream")
router.register("live-updates", LiveUpdateViewSet, basename="live-update")

urlpatterns = router.urls
