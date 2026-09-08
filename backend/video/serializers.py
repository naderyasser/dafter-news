from rest_framework import serializers

from .models import Reel, Video, VideoComment
from .youtube import UNTITLED_REEL_TITLE, attach_scraped_metadata, extract_video_id


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
    YouTube link — and both the title and the poster are read off YouTube
    for it (see video/youtube.py).

    `title` and `thumbnail` stay writable and optional: an editor can set
    either by hand (a caption that isn't the headline they want, a video
    whose poster YouTube won't serve), and a value sent this way always
    outranks whatever the fetch would have picked. `youtube_id` is read-only:
    the model derives it from `url` on every save.
    """

    title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    thumbnail = serializers.ImageField(required=False, allow_null=True)
    # Read-only: system-derived from the title once that settles (see
    # Reel.assign_slug and _finalize below), exposed so the frontend can
    # build /reel/<slug>.
    slug = serializers.SlugField(read_only=True)
    youtube_id = serializers.CharField(read_only=True)

    class Meta:
        model = Reel
        fields = ["id", "title", "slug", "thumbnail", "url", "youtube_id", "order", "created_at"]

    def validate_url(self, value):
        """
        A link the player cannot embed is a dead card — refuse it at the edge
        with a field error rather than saving a row the rail hides. The same
        video pasted twice (the easiest slip on a one-field form) is refused
        too: two cards for one reel is never what the desk meant.
        """
        video_id = extract_video_id(value)
        if not video_id:
            raise serializers.ValidationError(
                "الرابط لازم يكون رابط فيديو على يوتيوب (youtube.com/shorts/… أو youtu.be/…)."
            )
        duplicates = Reel.objects.filter(youtube_id=video_id)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError("هذا الفيديو مضاف بالفعل إلى «حصل إيه؟».")
        return value

    def create(self, validated_data):
        """
        Save first, then fetch.

        In that order because the fetch is a network call to a third party:
        it takes a moment, it can fail, and a reel whose title or picture
        could not be retrieved is still a reel the newsroom meant to publish.
        Only the halves the client left blank are fetched — a title or a
        poster set by hand in the same request outranks the fetch.
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
        Re-fetch only when the link changed, and only the halves the same
        request didn't set by hand — reordering the rail is one PATCH per
        card, and none of those should hit YouTube again.
        """
        previous_url = instance.url
        manual_title = bool(validated_data.get("title"))
        manual_thumbnail = "thumbnail" in validated_data
        reel = super().update(instance, validated_data)
        if reel.url != previous_url and (not manual_title or not manual_thumbnail):
            attach_scraped_metadata(reel, want_title=not manual_title, want_image=not manual_thumbnail)
            self._finalize(reel)
        return reel

    @staticmethod
    def _finalize(reel):
        """
        The one point in the write path where `reel.title` is settled —
        fetched, manually supplied, or about to fall back to
        UNTITLED_REEL_TITLE — and so the first safe point to derive a real
        slug from it, replacing the `reel-<pk>` placeholder Reel.save()
        assigned on creation.
        """
        changed = []
        if not reel.title:
            reel.title = UNTITLED_REEL_TITLE
            changed.append("title")
        reel.assign_slug()
        changed.append("slug")
        reel.save(update_fields=changed)
