from rest_framework import serializers

from .models import Match, PrayerTimes, SyncLog, WireArticle


class SyncLogSerializer(serializers.ModelSerializer):
    is_stale = serializers.BooleanField(read_only=True)

    class Meta:
        model = SyncLog
        fields = [
            "id", "source", "label", "status", "message", "records",
            "last_attempt_at", "last_success_at", "consecutive_failures", "is_stale",
        ]


class WireArticleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WireArticle
        fields = [
            "id", "title", "summary", "url", "image_url",
            "source_name", "provider", "language", "published_at",
        ]


class MatchSerializer(serializers.ModelSerializer):
    score_label = serializers.CharField(read_only=True)

    class Meta:
        model = Match
        fields = [
            "id", "league", "home_team", "away_team", "home_score", "away_score",
            "score_label", "status", "kickoff_at", "round_label", "venue",
        ]


class PrayerTimesSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrayerTimes
        fields = ["id", "city_key", "date", "hijri_date", "fajr", "dhuhr", "asr", "maghrib", "isha"]
