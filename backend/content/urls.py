from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    ArticleViewSet,
    BreakingNewsItemViewSet,
    CommentViewSet,
    DashboardOverviewView,
    ImportFromUrlView,
    SectionViewSet,
    StoryViewSet,
    TagViewSet,
    UrgentNotificationView,
)

router = DefaultRouter()
router.register("articles", ArticleViewSet, basename="article")
router.register("sections", SectionViewSet, basename="section")
router.register("tags", TagViewSet, basename="tag")
router.register("comments", CommentViewSet, basename="comment")
router.register("breaking", BreakingNewsItemViewSet, basename="breaking")
router.register("stories", StoryViewSet, basename="story")

urlpatterns = router.urls + [
    path("dashboard/overview/", DashboardOverviewView.as_view(), name="dashboard-overview"),
    path("urgent-notification/", UrgentNotificationView.as_view(), name="urgent-notification"),
    # Not nested under articles/ — the router's slug lookup pattern would
    # greedily match "import-from-url" as a detail route before this ever
    # gets a chance, since DRF's default lookup regex accepts anything
    # without a "/" or ".".
    path("import-from-url/", ImportFromUrlView.as_view(), name="import-from-url"),
]
