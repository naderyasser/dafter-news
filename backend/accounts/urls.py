from django.urls import path
from rest_framework.routers import DefaultRouter

from . import auth_views
from .views import AuthorViewSet, FollowViewSet, MyFeedView, SavedArticleViewSet, UserViewSet

router = DefaultRouter()
router.register("authors", AuthorViewSet, basename="author")
router.register("users", UserViewSet, basename="user")
router.register("follows", FollowViewSet, basename="follow")
router.register("saved", SavedArticleViewSet, basename="saved-article")

urlpatterns = router.urls + [
    path("auth/csrf/", auth_views.csrf, name="auth-csrf"),
    path("auth/login/", auth_views.login_view, name="auth-login"),
    path("auth/logout/", auth_views.logout_view, name="auth-logout"),
    path("auth/register/", auth_views.register, name="auth-register"),
    path("auth/me/", auth_views.me, name="auth-me"),
    path("auth/change-password/", auth_views.change_password, name="auth-change-password"),
    path("my-feed/", MyFeedView.as_view(), name="my-feed"),
]
