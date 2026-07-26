from django.contrib import admin

from .models import LiveStream, LiveUpdate


class LiveUpdateInline(admin.TabularInline):
    model = LiveUpdate
    extra = 0


@admin.register(LiveStream)
class LiveStreamAdmin(admin.ModelAdmin):
    list_display = ("title", "is_live", "created_at")
    inlines = [LiveUpdateInline]
