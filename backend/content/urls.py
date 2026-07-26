from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    ArticleViewSet,
    BreakingNewsItemViewSet,
    CommentViewSet,
    DashboardOverviewView,
    SectionViewSet,
    StoryViewSet,
    TagViewSet,
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
]
