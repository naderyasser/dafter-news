from django.contrib import admin

from .models import Video, VideoComment


class VideoCommentInline(admin.TabularInline):
    model = VideoComment
    extra = 0


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "is_live", "is_exclusive", "views", "created_at")
    list_filter = ("is_live", "is_exclusive", "section")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [VideoCommentInline]
