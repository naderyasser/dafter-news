from rest_framework import serializers

from .models import User


class AuthorSerializer(serializers.ModelSerializer):
    """Public-facing author card (Authors.dc.html / AuthorPage.dc.html)."""

    name = serializers.CharField(source="display_name", read_only=True)
    initial = serializers.CharField(read_only=True)
    article_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name", "initial", "bio", "title", "avatar", "article_count", "date_joined"]

    def get_article_count(self, obj):
        return obj.articles.filter(status="published").count()


class UserSerializer(serializers.ModelSerializer):
    """Dashboard row (DashUsers.dc.html)."""

    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "name", "email", "role", "last_login", "is_active", "date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            # No password supplied (the dashboard's "+ مستخدم جديد" drawer
            # doesn't collect one): leave the account without a usable
            # password so it can only be activated via a set/reset flow.
            # NB: UserManager.make_random_password() was removed in Django
            # 5.1, so don't reach for it here.
            user.set_unusable_password()
        user.save()
        return user
