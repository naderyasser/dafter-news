from django.db import IntegrityError, transaction
from django.utils.text import slugify
from rest_framework import serializers

from accounts.serializers import AuthorSerializer

from .models import Article, ArticleBlock, BreakingNewsItem, Comment, Section, Story, Tag


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "key", "name_ar", "name_en", "order", "article_count", "cover_image", "tagline"]


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "slug"]


class ArticleBlockSerializer(serializers.ModelSerializer):
    related_article_slug = serializers.CharField(source="related_article.slug", read_only=True, default=None)
    # The "اقرأ أيضاً" box links straight to the related article's slug — an
    # opinion piece 404s under /article/[slug] (see app/article/[slug]'s
    # generateMetadata, which gates on kind === "news"), so the frontend
    # needs this to route it to /opinion/[slug] instead.
    related_article_kind = serializers.CharField(source="related_article.kind", read_only=True, default=None)
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
            "id", "order", "type", "text", "align", "image", "caption", "credit",
            "related_article", "related_article_slug", "related_article_kind", "asset_id", "image_name", "keep_image",
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
    # A manual byline (typed in the editor) wins over a linked account
    # entirely when both are set, not just its name — a deliberate override
    # of "who wrote this", so a card must not still link out to a different
    # person's profile or photo under the overridden name.
    author_name = serializers.SerializerMethodField()
    author_name_en = serializers.SerializerMethodField()
    author_username = serializers.SerializerMethodField()
    author_initial = serializers.SerializerMethodField()
    # The «ملف خاص» rail puts the investigator's face on the card — the
    # journalist chip is that section's whole visual identity.
    author_avatar = serializers.SerializerMethodField()
    # A prose summary for surfaces that have only the card shape to read
    # from — specifically the RSS feed's <description>, which Google News
    # prints under the headline. Mirrors ArticleDetail's rule (the desk's
    # standfirst, else the opening paragraph) so a story summarises the same
    # way wherever it's quoted; without it the feed fell back to the section
    # name, and «عرب وعالم» as a story's entire summary tells a reader
    # nothing. Most articles here are filed without a standfirst, so the
    # paragraph branch is the common case, not the edge one.
    excerpt = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "id", "title", "slug", "href_slug", "section_name", "subcategory", "country", "badge", "status", "cover_image",
            "standfirst",
            # The cover's real pixel size, stamped by ImageField at upload
            # time (see Article.cover_image). Carried on the card — not just
            # the detail shape — because the RSS feed is built from card
            # rows, and <media:content> is the one place Google News reads an
            # article's thumbnail from: declaring the true dimensions is what
            # lets it pick the image at all rather than skip an unmeasurable
            # one. Both are null for covers uploaded before the columns
            # existed, and lib/rss.ts simply omits the attributes then.
            "cover_image_width", "cover_image_height",
            "published_at", "views", "kind", "comment_count", "author_name", "author_name_en", "author_username", "author_initial",
            "author_avatar", "excerpt",
        ]

    def get_section_name(self, obj):
        return section_name_for(obj)

    def get_author_name(self, obj):
        byline = obj.byline.strip()
        if byline:
            return byline
        return obj.author.display_name if obj.author_id else None

    def get_author_initial(self, obj):
        byline = obj.byline.strip()
        if byline:
            return byline[:1]
        return obj.author.initial if obj.author_id else None

    def get_author_name_en(self, obj):
        if obj.byline.strip():
            return None
        return obj.author.name_en if obj.author_id else None

    def get_author_username(self, obj):
        if obj.byline.strip():
            return None
        return obj.author.username if obj.author_id else None

    def get_author_avatar(self, obj):
        """
        Unlike get_author_name/_initial, NOT suppressed by a manual byline.
        A byline overriding the displayed *name* is a deliberate credit
        override (see Article.byline's own docstring) — but a linked
        account's photo isn't part of that override, it's just whether one
        was ever uploaded. Suppressing it too meant a linked columnist's
        real photo stayed invisible on every card/list (the opinion
        carousel, the section front) any time an editor happened to also
        leave the old manual byline text in place instead of clearing it —
        exactly the state legacy articles were saved in before the dashboard
        gained a real author picker.
        """
        if not obj.author_id or not obj.author.avatar:
            return None
        return obj.author.avatar.url

    def get_excerpt(self, obj):
        """
        Iterates `obj.blocks.all()` and filters in Python rather than issuing
        `.filter(type=...)`: every caller prefetches `blocks`, and re-filtering
        the related manager would ignore that cache and put a query behind
        every card in the list.

        Returned with the editor's inline tokens ({b|…}, {c:red|…}) still in
        it — stripping them needs the token grammar, which lives in
        frontend/lib/richtext.ts. Capped at 600 characters, well past the
        ~300 any consumer shows, so the string stays bounded without the cut
        landing inside the part that gets displayed.
        """
        text = (obj.standfirst or "").strip()
        if not text:
            para = next(
                (b for b in obj.blocks.all() if b.type == ArticleBlock.Type.PARAGRAPH and (b.text or "").strip()),
                None,
            )
            text = (para.text if para else "").strip()
        return " ".join(text.split())[:600]


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
            "id", "title", "slug", "kind", "section", "subcategory", "country", "author", "byline", "tags", "language", "related_article",
            "status", "badge", "pinned", "notify_urgent", "notify_label", "standfirst", "cover_image", "cover_image_width", "cover_image_height",
            "cover_caption", "cover_credit",
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
    # max_length mirrors Tag.name's column width. Without it a long tag was
    # accepted here and only rejected by Postgres, deep inside _sync_tags —
    # i.e. as a 500 on a half-written article rather than a 400 naming the
    # field, which is the whole point of validating at the edge.
    tag_names = serializers.ListField(
        child=serializers.CharField(max_length=60, allow_blank=True), write_only=True, required=False
    )
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
            "id", "title", "slug", "kind", "section", "subcategory", "country", "author", "byline", "language", "related_article",
            "status", "badge", "standfirst", "cover_image", "cover_caption", "cover_credit",
            "scheduled_for", "blocks", "tag_names", "cover_asset_id", "pinned", "notify_urgent", "notify_label",
            "push_breaking", "push_story",
        ]

    # Atomic because a save is one editorial act, not five.
    #
    # An article's row, its cover, its tags, its body blocks and its ticker/
    # stories placement were each committed on their own, in that order. When
    # a later step raised — and _sync_tags did, on a tag-slug collision — the
    # earlier ones stayed committed: the newsroom was left with a *ghost
    # article* carrying its title, section, cover and flags but no body at
    # all, while the editor saw only "تعذّر حفظ الخبر" and had no way to tell
    # that anything had been written. Re-opening that ghost to paste the body
    # back in hit the same tag on the way out and failed identically, so the
    # story could never be completed from the editor at all.
    #
    # Wrapping the whole thing means a failed save now leaves *nothing*
    # behind, and the editor still has the article they typed on screen to
    # retry — an error the person can act on instead of silent, unfinishable
    # wreckage in the database.
    @transaction.atomic
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

    @transaction.atomic
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

        The href itself has to route the same way frontend/app/sitemap.ts's
        own entry() helper already does: an opinion piece lives at
        /opinion/<slug>, an English news article at /en/article/<slug>.
        Building it as bare /article/<slug> regardless of kind/language was a
        latent bug — pushing an English or opinion article landed a ticker/
        stories-rail entry that either rendered under the wrong edition's RTL
        Arabic chrome (the AR article route doesn't gate on language) or
        404'd outright (that route does gate on kind != "news").
        """
        if article.status != Article.Status.PUBLISHED:
            return
        if article.kind == Article.Kind.OPINION:
            href = f"/opinion/{article.slug}"
        elif article.language == Article.Language.EN:
            href = f"/en/article/{article.slug}"
        else:
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
        # The width/height columns are in the list because assigning
        # cover_image is what stamps them (see Article.cover_image's
        # width_field/height_field) — leaving them out of update_fields set
        # them on the instance and then declined to write them, so every
        # cover picked from the media library kept NULL dimensions and its
        # og:image lost the size declaration that stops Facebook/WhatsApp
        # dropping the link preview's photo.
        article.save(update_fields=["cover_image", "cover_image_width", "cover_image_height", "cover_credit"])

    @staticmethod
    def _sync_tags(article, tag_names):
        if not tag_names:
            return
        tags = []
        seen = set()
        for raw in tag_names:
            name = (raw or "").strip()
            if not name:
                continue
            slug = ArticleWriteSerializer._tag_slug(name)
            # Two names in one payload can slugify to the same thing («عاجل»
            # and «#عاجل»); the second would collide with the row the first
            # just created, in this very request.
            if slug in seen:
                continue
            seen.add(slug)
            tags.append(ArticleWriteSerializer._tag_for(name, slug))
        article.tags.set(tags)

    @staticmethod
    def _tag_slug(name):
        # Same slugify(allow_unicode=True) Article.save() uses — plain
        # `.replace(" ", "-")` leaves punctuation like "/" untouched, which
        # the router then reads as a path separator and the tag can never be
        # looked up again by slug. Trimmed to the column width so a long tag
        # can't overflow SlugField(max_length=70) either.
        return (slugify(name, allow_unicode=True) or "tag")[:70]

    @staticmethod
    def _tag_for(name, slug):
        """
        Find or create the tag, resolving on **both** unique columns.

        This was a `get_or_create(name=name, ...)`, which looks up on `name`
        alone — but `slug` carries a unique constraint of its own, and
        slugify() is lossy: it strips the punctuation that makes two names
        different. Production had `Tag(name="#عاجل", slug="عاجل")`, so an
        editor tagging a story «عاجل» matched no row by name, and the INSERT
        that followed hit `content_tag_slug_key` — an IntegrityError, a 500,
        and a half-saved article. Every 500 in the newsroom's save log was
        this: «عاجل», «السعودية», «الإسكندرية» — the newsroom's most-used
        tags, so it fired constantly.

        Name first, then slug: an exact name is the tag the editor actually
        typed, and only when there is no such tag does the slug decide — at
        which point reusing the existing row is the only option anyway, since
        the slug is the tag's public URL and two rows cannot share it.
        """
        tag = Tag.objects.filter(name=name).first() or Tag.objects.filter(slug=slug).first()
        if tag is not None:
            return tag
        try:
            # Savepoint: the caller's save runs in one transaction, and on
            # Postgres a failed INSERT aborts it outright — without this the
            # collision we're recovering from would poison the whole save.
            with transaction.atomic():
                return Tag.objects.create(name=name, slug=slug)
        except IntegrityError:
            # A concurrent save won the insert between the lookup and here.
            existing = Tag.objects.filter(name=name).first() or Tag.objects.filter(slug=slug).first()
            if existing is None:
                raise
            return existing

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
