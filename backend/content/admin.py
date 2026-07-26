from django.contrib import admin

from .models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Tag


class ArticleBlockInline(admin.TabularInline):
    model = ArticleBlock
    fk_name = "article"
    extra = 0


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "author", "kind", "status", "badge", "language", "views", "published_at")
    list_filter = ("status", "kind", "language", "section", "badge")
    search_fields = ("title", "standfirst")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ArticleBlockInline]


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("name_ar", "name_en", "key", "order", "article_count")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("user_name", "article", "status", "created_at")
    list_filter = ("status",)


@admin.register(BreakingNewsItem)
class BreakingNewsItemAdmin(admin.ModelAdmin):
    list_display = ("text", "active", "order", "expires_at")
    list_editable = ("active", "order")
