from rest_framework import serializers

from .models import LiveStream, LiveUpdate


class LiveUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveUpdate
        fields = ["id", "stream", "time_label", "text", "created_at"]


class LiveStreamSerializer(serializers.ModelSerializer):
    updates = LiveUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = LiveStream
        fields = ["id", "title", "is_live", "cover_image", "stream_url", "updates", "created_at"]
