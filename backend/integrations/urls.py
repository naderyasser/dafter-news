from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import MatchViewSet, PrayerTimesView, SyncLogViewSet, SyncNowView, WireArticleViewSet

router = DefaultRouter()
router.register("wire", WireArticleViewSet, basename="wire-article")
router.register("matches", MatchViewSet, basename="match")
router.register("sync-logs", SyncLogViewSet, basename="sync-log")

urlpatterns = router.urls + [
    path("prayer-times/", PrayerTimesView.as_view(), name="prayer-times"),
    path("sync-now/", SyncNowView.as_view(), name="sync-now"),
]
