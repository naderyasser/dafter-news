from rest_framework import serializers

from .models import Video, VideoComment


class VideoCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoComment
        fields = ["id", "video", "name", "initial", "text", "created_at"]
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
    comments = VideoCommentSerializer(many=True, read_only=True)

    class Meta(VideoSerializer.Meta):
        fields = VideoSerializer.Meta.fields + ["comments"]
