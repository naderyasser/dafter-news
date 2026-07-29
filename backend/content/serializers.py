from django.utils.text import slugify
from rest_framework import serializers

from accounts.serializers import AuthorSerializer

from .models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "key", "name_ar", "name_en", "order", "article_count"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class ArticleBlockSerializer(serializers.ModelSerializer):
    related_article_slug = serializers.CharField(source="related_article.slug", read_only=True, default=None)
    # An image block can point at a library asset instead of uploading a new
    # file — the client's «إعادة الاستخدام السريع»: the block reuses the
    # asset's stored file, so nothing is downloaded and re-uploaded and the
    # library stays the single place where licensing is tracked.
    asset_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # _sync_blocks replaces every block on save, so the editor echoes this
    # back to keep an image it didn't change; without it, saving any edit
    # would silently strip the article's photos.
    image_name = serializers.CharField(source="image.name", read_only=True, default="")
    keep_image = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ArticleBlock
        fields = [
            "id", "order", "type", "text", "image", "caption", "credit",
            "related_article", "related_article_slug", "asset_id", "image_name", "keep_image",
        ]


def section_name_for(article):
    """
    Section label in the article's own language.

    Keyed off `article.language` rather than a request parameter so a card is
    labelled correctly wherever it appears — an English article surfaced in a
    mixed list still reads "Egypt", not "شؤون مصر". Falls back to the Arabic
    name because name_en is blank=True and Arabic is the site default.
    """
    section = article.section
    if section is None:
        return None
    if article.language == "en" and section.name_en:
        return section.name_en
    return section.name_ar


class ArticleCardSerializer(serializers.ModelSerializer):
    """Slim shape for grids/lists — mirrors ArticleCard.dc.html props."""

    section_name = serializers.SerializerMethodField()
    href_slug = serializers.CharField(source="slug", read_only=True)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    author_name = serializers.CharField(source="author.display_name", read_only=True, default=None)
    author_name_en = serializers.CharField(source="author.name_en", read_only=True, default=None)
    author_username = serializers.CharField(source="author.username", read_only=True, default=None)
    author_initial = serializers.CharField(source="author.initial", read_only=True, default=None)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "href_slug", "section_name", "subcategory", "badge", "status", "cover_image",
            "published_at", "views", "kind", "comment_count", "author_name", "author_name_en", "author_username", "author_initial",
        ]

    def get_section_name(self, obj):
        return section_name_for(obj)


class ArticleDetailSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    blocks = ArticleBlockSerializer(many=True, read_only=True)
    read_minutes = serializers.IntegerField(read_only=True)
    comments = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "kind", "section", "subcategory", "author", "tags", "language", "related_article",
            "status", "badge", "pinned", "standfirst", "cover_image", "cover_caption", "cover_credit",
            "views", "read_minutes", "tts_status", "tts_audio", "tts_duration_seconds",
            "published_at", "scheduled_for", "created_at", "blocks", "comments",
        ]

    def get_comments(self, obj):
        """
        The article's public conversation, embedded the way VideoDetail embeds
        its comments — because there is no other door: /api/comments/ is
        PublicSubmission (anonymous POST only, staff GET), so a reader has no
        endpoint to list from, and opening one would mean a second place that
        has to remember to hide the moderation queue. Approved rows only, and
        only the reader-safe columns — status and article_title are queue
        furniture, and a pending or banned row must never travel here no
        matter who is asking, staff included: this payload is cached by the
        public article page for every visitor for the whole revalidate window.
        """
        rows = obj.comments.filter(status=Comment.Status.APPROVED).order_by("-created_at")[:50]
        return [
            {"id": c.id, "user_name": c.user_name, "text": c.text, "created_at": c.created_at.isoformat()}
            for c in rows
        ]


class ArticleWriteSerializer(serializers.ModelSerializer):
    """Used by the dashboard block editor (DashArticleEditor.dc.html)."""

    blocks = ArticleBlockSerializer(many=True, required=False)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    # Optional on write — Article.save() derives it from the title (the
    # browser can't slugify Arabic without stripping it away entirely).
    slug = serializers.SlugField(max_length=300, allow_unicode=True, required=False)
    # Cover from the media library, by asset id — same reuse rule as the
    # image blocks' asset_id.
    cover_asset_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    # One-click publishing surfaces (the client's «التحكم في أماكن العرض»):
    # tick a box in the editor and the story lands in the «عاجل» ticker or the
    # front-page stories rail alongside the article itself. Both act only when
    # the article is actually published — a draft in the breaking ticker would
    # link to a 404.
    push_breaking = serializers.BooleanField(write_only=True, required=False, default=False)
    push_story = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "kind", "section", "subcategory", "author", "language", "related_article",
            "status", "badge", "standfirst", "cover_image", "cover_caption", "cover_credit",
            "scheduled_for", "blocks", "tag_names", "cover_asset_id", "pinned", "push_breaking", "push_story",
        ]

    def create(self, validated_data):
        blocks_data = validated_data.pop("blocks", [])
        tag_names = validated_data.pop("tag_names", [])
        cover_asset_id = validated_data.pop("cover_asset_id", None)
        push_breaking = validated_data.pop("push_breaking", False)
        push_story = validated_data.pop("push_story", False)
        article = Article.objects.create(**validated_data)
        self._apply_cover_asset(article, cover_asset_id)
        self._sync_tags(article, tag_names)
        self._sync_blocks(article, blocks_data)
        self._push_surfaces(article, push_breaking, push_story)
        return article

    def update(self, instance, validated_data):
        blocks_data = validated_data.pop("blocks", None)
        tag_names = validated_data.pop("tag_names", None)
        cover_asset_id = validated_data.pop("cover_asset_id", None)
        push_breaking = validated_data.pop("push_breaking", False)
        push_story = validated_data.pop("push_story", False)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._apply_cover_asset(instance, cover_asset_id)
        if tag_names is not None:
            self._sync_tags(instance, tag_names)
        if blocks_data is not None:
            self._sync_blocks(instance, blocks_data)
        self._push_surfaces(instance, push_breaking, push_story)
        return instance

    @staticmethod
    def _push_surfaces(article, push_breaking, push_story):
        """One-click placement in the «عاجل» ticker and the stories rail.

        update_or_create is keyed on `href` (which embeds the article's slug),
        not on the article's title text, so ticking the box again on a later
        edit — even one that renames the article — refreshes the same entry
        instead of either colliding with an unrelated article that happens to
        share a title, or leaving a stale copy of the old title live forever.
        Article.slug is unique and never changes on its own once set, so href
        is a stable per-article key that plain title text isn't.
        """
        if article.status != Article.Status.PUBLISHED:
            return
        href = f"/article/{article.slug}"
        if push_breaking:
            BreakingNewsItem.objects.update_or_create(
                href=href,
                defaults={"text": article.title, "active": True, "order": 0},
            )
        if push_story:
            first = (Story.objects.order_by("order").values_list("order", flat=True).first() or 1) - 1
            defaults = dict(title=article.title, section=article.section, active=True, order=first)
            if article.cover_image:
                defaults["image"] = article.cover_image.name
            Story.objects.update_or_create(href=href, defaults=defaults)

    @staticmethod
    def _apply_cover_asset(article, asset_id):
        """Point cover_image at a library asset's file — a reference, not a
        copy, so the library remains the one place the file (and its license)
        lives. The asset's credit fills cover_credit only when the editor
        left it blank."""
        if not asset_id:
            return
        from media_library.models import MediaAsset

        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None or not asset.image:
            return
        article.cover_image = asset.image.name
        if not article.cover_credit and asset.credit:
            article.cover_credit = asset.credit
        article.save(update_fields=["cover_image", "cover_credit"])

    @staticmethod
    def _sync_tags(article, tag_names):
        if not tag_names:
            return
        tags = []
        for name in tag_names:
            # Same slugify(allow_unicode=True) Article.save() uses — plain
            # `.replace(" ", "-")` leaves punctuation like "/" untouched,
            # which the router then reads as a path separator and the tag
            # can never be looked up again by slug.
            tag, _ = Tag.objects.get_or_create(name=name, defaults={"slug": slugify(name, allow_unicode=True) or "tag"})
            tags.append(tag)
        article.tags.set(tags)

    @staticmethod
    def _sync_blocks(article, blocks_data):
        from media_library.models import MediaAsset

        article.blocks.all().delete()
        # Files may only be referenced from the app's own upload directories —
        # keep_image echoes a stored name back, and this stops it from being
        # pointed anywhere else under MEDIA_ROOT.
        allowed_prefixes = ("library/", "article_blocks/", "covers/", "video_covers/")
        for i, block in enumerate(blocks_data):
            asset_id = block.pop("asset_id", None)
            keep_image = (block.pop("keep_image", "") or "").strip()
            kwargs = {k: v for k, v in block.items() if k != "order"}
            if asset_id:
                asset = MediaAsset.objects.filter(pk=asset_id).first()
                if asset is not None and asset.image:
                    kwargs["image"] = asset.image.name
                    if not kwargs.get("credit") and asset.credit:
                        kwargs["credit"] = asset.credit
            elif keep_image and keep_image.startswith(allowed_prefixes) and ".." not in keep_image:
                kwargs["image"] = keep_image
            ArticleBlock.objects.create(article=article, order=block.get("order", i), **kwargs)


class CommentSerializer(serializers.ModelSerializer):
    article_title = serializers.CharField(source="article.title", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "article", "article_title", "user_name", "text", "status", "created_at"]


class BreakingNewsItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreakingNewsItem
        fields = ["id", "text", "href", "order", "active", "expires_at", "created_at"]


class StorySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source="section.name_ar", read_only=True)

    class Meta:
        model = Story
        fields = ["id", "title", "image", "href", "section", "section_name", "active", "order"]
