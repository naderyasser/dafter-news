from django.contrib import admin

from .models import MediaAsset


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ("alt", "credit", "created_at")
    search_fields = ("alt", "credit")
