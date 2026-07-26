from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import DailyVisitViewSet, SiteSettingsView, SocialLinkViewSet, WelcomeAlertView

router = DefaultRouter()
router.register("social-links", SocialLinkViewSet, basename="social-link")
router.register("daily-visits", DailyVisitViewSet, basename="daily-visit")

urlpatterns = router.urls + [
    path("settings/", SiteSettingsView.as_view(), name="site-settings"),
    path("welcome-alert/", WelcomeAlertView.as_view(), name="welcome-alert"),
]
