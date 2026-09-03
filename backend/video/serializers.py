from rest_framework import serializers

from .models import Reel, Video, VideoComment
from .og import UNTITLED_REEL_TITLE, attach_scraped_metadata


class VideoCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoComment
        fields = ["id", "video", "name", "initial", "text", "status", "created_at"]
        read_only_fields = ["initial"]


class VideoSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source="section.name_ar", read_only=True)
    duration_label = serializers.CharField(read_only=True)
    comment_count = serializers.IntegerField(source="comments.count", read_only=True)

    # Optional on write — Video.save() derives it from the title.
    slug = serializers.SlugField(max_length=300, allow_unicode=True, required=False)

    class Meta:
        model = Video
        fields = [
            "id", "title", "slug", "section", "section_name", "description", "cover_image", "file",
            "external_url", "duration_seconds", "duration_label", "is_live", "is_exclusive", "views",
            "comment_count", "created_at",
        ]


class VideoDetailSerializer(VideoSerializer):
    # A plain nested serializer would embed every comment regardless of
    # moderation status, publishing an anonymous submission the instant it
    # arrives — the video page has no other gate (unlike article comments,
    # which are only ever listed through the staff-only /api/comments/
    # endpoint). Anonymous/reader callers only ever see approved comments;
    # staff moderating from the dashboard see the full queue, pending included.
    comments = serializers.SerializerMethodField()

    class Meta(VideoSerializer.Meta):
        fields = VideoSerializer.Meta.fields + ["comments"]

    def get_comments(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_staff = bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))
        queryset = obj.comments.all() if is_staff else obj.comments.filter(status=VideoComment.Status.APPROVED)
        return VideoCommentSerializer(queryset, many=True, context=self.context).data


class ReelSerializer(serializers.ModelSerializer):
    """
    What the shelf renders. ONE field is asked of an editor — the reel's
    Facebook link — and both the title and the poster are read off that link's
    own page (see video/og.py).

    `title` and `thumbnail` both stay writable, and both stay optional: an
    editor can still set either by hand (for the reel whose page Facebook
    won't serve, or whose scraped caption isn't the headline they want), and a
    value sent this way always outranks whatever the scrape would have picked.
    `thumbnail` comes back as a URL (DRF's ImageField default), which is what
    the card's poster needs and what the brief calls `thumbnail_url`.
    """

    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    thumbnail = serializers.ImageField(required=False, allow_null=True)
    # Read-only: unlike Video's own `slug`, there is no dashboard field for
    # this and no reason to add one — the whole point of this model is that
    # an editor manages none of its metadata by hand. It is system-derived
    # from the title once that settles (see Reel.assign_slug and _finalize
    # below), and exposed here only so the frontend can build /reel/<slug>.
    slug = serializers.SlugField(read_only=True)

    class Meta:
        model = Reel
        fields = ["id", "title", "slug", "thumbnail", "facebook_url", "order", "created_at"]

    def create(self, validated_data):
        """
        Save first, then scrape.

        In that order because the scrape is a network call to a third party: it
        takes a second or two, it can fail, and a reel whose title or picture
        could not be retrieved is still a reel the newsroom meant to publish.
        Saving first means a Facebook outage costs the card its text and its
        poster, never its row.

        Only the fields the client left blank are asked for — a title or a
        poster an editor set by hand in the same request outranks the scrape,
        same as an update (see below).
        """
        reel = super().create(validated_data)
        want_title = not reel.title
        want_image = not reel.thumbnail
        if want_title or want_image:
            attach_scraped_metadata(reel, want_title=want_title, want_image=want_image)
        self._finalize(reel)
        return reel

    def update(self, instance, validated_data):
        """
        Re-scrape only when the link changed, and only the halves the same
        request didn't set by hand.

        Gated on the link changing at all — reordering the rail is one PATCH
        per card, and without this every one of those would hit Facebook again
        for text and a picture that have not changed.
        """
        previous_url = instance.facebook_url
        manual_title = bool(validated_data.get("title"))
        manual_thumbnail = "thumbnail" in validated_data
        reel = super().update(instance, validated_data)
        if reel.facebook_url != previous_url and (not manual_title or not manual_thumbnail):
            attach_scraped_metadata(reel, want_title=not manual_title, want_image=not manual_thumbnail)
            self._finalize(reel)
        return reel

    @staticmethod
    def _finalize(reel):
        """
        The one point in the write path where `reel.title` is actually
        settled — scraped, manually supplied, or about to fall back to
        UNTITLED_REEL_TITLE — which makes it also the first safe point to
        derive a real slug from it. `reel.slug` already holds the temporary
        `reel-<pk>` placeholder Reel.save() assigned on creation (see its own
        docstring); this replaces it with one that actually reads as the
        reel's own title, giving `/reel/<slug>` a real permalink instead of
        an opaque id-based one.

        The blank-title case is the one the scrape can leave unhandled: the
        client sent no title and the page carried neither an og:description
        nor an og:title (a deleted reel, a fetch that failed outright). A
        blank cell in the dashboard list reads as the same "did this render"
        doubt an unset thumbnail already caused once, so this is a
        placeholder TEXT, not a placeholder image — there is nothing to draw
        for a title.
        """
        changed = []
        if not reel.title:
            reel.title = UNTITLED_REEL_TITLE
            changed.append("title")
        reel.assign_slug()
        changed.append("slug")
        reel.save(update_fields=changed)
