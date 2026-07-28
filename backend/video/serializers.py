from rest_framework import serializers

from .models import Video, VideoComment


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
