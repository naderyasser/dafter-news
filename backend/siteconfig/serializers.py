from rest_framework import serializers

from .models import DailyVisit, SiteSettings, SocialLink, WelcomeAlert


class SocialLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialLink
        fields = ["id", "platform", "url"]


class SiteSettingsSerializer(serializers.ModelSerializer):
    social_links = serializers.SerializerMethodField()

    class Meta:
        model = SiteSettings
        fields = [
            "id", "site_name", "tagline", "logo", "seo_title", "seo_description",
            "lang_ar_enabled", "lang_en_enabled", "social_links",
        ]

    def get_social_links(self, obj):
        return SocialLinkSerializer(SocialLink.objects.all(), many=True).data


class DailyVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyVisit
        fields = ["id", "date", "visits", "change_pct"]


class WelcomeAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = WelcomeAlert
        fields = ["id", "active", "kicker", "title", "text", "cta_label", "cta_href", "image"]
