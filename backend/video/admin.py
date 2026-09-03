from django.contrib import admin

from .models import Reel, Video, VideoComment


class VideoCommentInline(admin.TabularInline):
    model = VideoComment
    extra = 0


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "is_live", "is_exclusive", "views", "created_at")
    list_filter = ("is_live", "is_exclusive", "section")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [VideoCommentInline]


@admin.register(Reel)
class ReelAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "facebook_url", "order", "created_at")
    list_editable = ("order",)
    search_fields = ("title",)
    # Same as VideoAdmin: a JS convenience while typing in this form only —
    # it does not cover the dashboard's own one-field create flow, which
    # never shows a slug field at all and relies on Reel.assign_slug instead.
    prepopulated_fields = {"slug": ("title",)}
