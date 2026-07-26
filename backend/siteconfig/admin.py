from django.contrib import admin

from .models import DailyVisit, SiteSettings, SocialLink


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ("site_name", "tagline", "lang_ar_enabled", "lang_en_enabled")

    def has_add_permission(self, request):
        return not SiteSettings.objects.exists()


@admin.register(SocialLink)
class SocialLinkAdmin(admin.ModelAdmin):
    list_display = ("platform", "url")


@admin.register(DailyVisit)
class DailyVisitAdmin(admin.ModelAdmin):
    list_display = ("date", "visits", "change_pct")
