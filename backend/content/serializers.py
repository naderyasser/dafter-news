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

    class Meta:
        model = ArticleBlock
        fields = ["id", "order", "type", "text", "image", "caption", "credit", "related_article", "related_article_slug"]


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
    author_username = serializers.CharField(source="author.username", read_only=True, default=None)
    author_initial = serializers.CharField(source="author.initial", read_only=True, default=None)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "href_slug", "section_name", "badge", "status", "cover_image",
            "published_at", "views", "kind", "comment_count", "author_name", "author_username", "author_initial",
        ]

    def get_section_name(self, obj):
        return section_name_for(obj)


class ArticleDetailSerializer(serializers.ModelSerializer):
    section = SectionSerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    blocks = ArticleBlockSerializer(many=True, read_only=True)
    read_minutes = serializers.IntegerField(read_only=True)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "kind", "section", "author", "tags", "language", "related_article",
            "status", "badge", "standfirst", "cover_image", "cover_caption", "cover_credit",
            "views", "read_minutes", "tts_status", "tts_audio", "tts_duration_seconds",
            "published_at", "scheduled_for", "created_at", "blocks",
        ]


class ArticleWriteSerializer(serializers.ModelSerializer):
    """Used by the dashboard block editor (DashArticleEditor.dc.html)."""

    blocks = ArticleBlockSerializer(many=True, required=False)
    tag_names = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    # Optional on write — Article.save() derives it from the title (the
    # browser can't slugify Arabic without stripping it away entirely).
    slug = serializers.SlugField(max_length=300, allow_unicode=True, required=False)

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "kind", "section", "author", "language", "related_article",
            "status", "badge", "standfirst", "cover_image", "cover_caption", "cover_credit",
            "scheduled_for", "blocks", "tag_names",
        ]

    def create(self, validated_data):
        blocks_data = validated_data.pop("blocks", [])
        tag_names = validated_data.pop("tag_names", [])
        article = Article.objects.create(**validated_data)
        self._sync_tags(article, tag_names)
        self._sync_blocks(article, blocks_data)
        return article

    def update(self, instance, validated_data):
        blocks_data = validated_data.pop("blocks", None)
        tag_names = validated_data.pop("tag_names", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if tag_names is not None:
            self._sync_tags(instance, tag_names)
        if blocks_data is not None:
            self._sync_blocks(instance, blocks_data)
        return instance

    @staticmethod
    def _sync_tags(article, tag_names):
        if not tag_names:
            return
        tags = []
        for name in tag_names:
            tag, _ = Tag.objects.get_or_create(name=name, defaults={"slug": name.replace(" ", "-")})
            tags.append(tag)
        article.tags.set(tags)

    @staticmethod
    def _sync_blocks(article, blocks_data):
        article.blocks.all().delete()
        for i, block in enumerate(blocks_data):
            ArticleBlock.objects.create(article=article, order=block.get("order", i), **{
                k: v for k, v in block.items() if k != "order"
            })


class CommentSerializer(serializers.ModelSerializer):
    article_title = serializers.CharField(source="article.title", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "article", "article_title", "user_name", "text", "status", "created_at"]


class BreakingNewsItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BreakingNewsItem
        fields = ["id", "text", "order", "active", "expires_at", "created_at"]


class StorySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source="section.name_ar", read_only=True)

    class Meta:
        model = Story
        fields = ["id", "title", "image", "href", "section", "section_name", "active", "order"]
