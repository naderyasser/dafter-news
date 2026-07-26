from rest_framework import serializers

from .models import AdPlacement


class AdPlacementSerializer(serializers.ModelSerializer):
    ctr = serializers.FloatField(read_only=True)

    class Meta:
        model = AdPlacement
        fields = [
            "id", "name", "size", "active", "impressions", "clicks", "ctr", "order",
            "scheduled_start", "scheduled_end",
        ]
