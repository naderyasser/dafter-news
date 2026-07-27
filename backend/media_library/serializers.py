from rest_framework import serializers

from .models import MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    # Enough to build the click-through in the library grid without a second
    # request per tile.
    article_title = serializers.CharField(source="article.title", read_only=True, default=None)
    article_slug = serializers.CharField(source="article.slug", read_only=True, default=None)
    license_label = serializers.CharField(source="get_license_display", read_only=True)

    class Meta:
        model = MediaAsset
        fields = [
            "id", "image", "title", "alt", "credit", "license", "license_label",
            "source", "article", "article_title", "article_slug", "created_at",
        ]
