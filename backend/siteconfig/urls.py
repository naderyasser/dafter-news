from rest_framework.routers import DefaultRouter

from django.urls import path

from . import push

from .views import DailyVisitViewSet, SiteSettingsView, SocialLinkViewSet, WelcomeAlertView

router = DefaultRouter()
router.register("social-links", SocialLinkViewSet, basename="social-link")
router.register("daily-visits", DailyVisitViewSet, basename="daily-visit")

urlpatterns = router.urls + [
    path("settings/", SiteSettingsView.as_view(), name="site-settings"),
    path("welcome-alert/", WelcomeAlertView.as_view(), name="welcome-alert"),
]
urlpatterns += [
    path("push/key/", push.vapid_public_key, name="push-key"),
    path("push/subscribe/", push.subscribe, name="push-subscribe"),
    path("push/unsubscribe/", push.unsubscribe, name="push-unsubscribe"),
    path("push/broadcast/", push.broadcast, name="push-broadcast"),
    path("push/status/", push.push_status, name="push-status"),
]
