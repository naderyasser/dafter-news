from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("accounts.urls")),
    path("api/", include("content.urls")),
    path("api/", include("media_library.urls")),
    path("api/", include("video.urls")),
    path("api/", include("live.urls")),
    path("api/", include("ads.urls")),
    path("api/", include("market.urls")),
    path("api/", include("siteconfig.urls")),
    path("api/", include("integrations.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
