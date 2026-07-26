from rest_framework.routers import DefaultRouter

from .views import AdPlacementViewSet

router = DefaultRouter()
router.register("ads", AdPlacementViewSet, basename="ad-placement")

urlpatterns = router.urls
