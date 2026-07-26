from rest_framework.routers import DefaultRouter

from .views import AuthorViewSet, UserViewSet

router = DefaultRouter()
router.register("authors", AuthorViewSet, basename="author")
router.register("users", UserViewSet, basename="user")

urlpatterns = router.urls
