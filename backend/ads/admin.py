from django.contrib import admin

from .models import AdPlacement


@admin.register(AdPlacement)
class AdPlacementAdmin(admin.ModelAdmin):
    list_display = ("name", "size", "active", "impressions", "clicks", "ctr")
    list_editable = ("active",)
