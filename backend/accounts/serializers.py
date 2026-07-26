from rest_framework import serializers

from .models import Follow, SavedArticle, User


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


class AccountSerializer(serializers.ModelSerializer):
    """The signed-in caller's own record — what /auth/me/ and login return."""

    name = serializers.CharField(source="display_name", read_only=True)
    is_staff_member = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "name", "email", "role", "avatar", "is_staff_member"]

    def get_is_staff_member(self, obj):
        """Drives the dashboard link in the header — staff flag, not role text."""
        return bool(obj.is_staff or obj.is_superuser)


class FollowSerializer(serializers.ModelSerializer):
    section_key = serializers.CharField(source="section.key", read_only=True)
    section_name = serializers.CharField(source="section.name_ar", read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)

    class Meta:
        model = Follow
        fields = ["id", "section", "author", "section_key", "section_name", "author_username", "author_name", "created_at"]

    def validate(self, attrs):
        if bool(attrs.get("section")) == bool(attrs.get("author")):
            raise serializers.ValidationError("اختر قسماً أو كاتباً — واحداً فقط.")
        return attrs


class SavedArticleSerializer(serializers.ModelSerializer):
    article_title = serializers.CharField(source="article.title", read_only=True)
    article_slug = serializers.CharField(source="article.slug", read_only=True)
    cover_image = serializers.ImageField(source="article.cover_image", read_only=True)

    class Meta:
        model = SavedArticle
        fields = ["id", "article", "article_title", "article_slug", "cover_image", "created_at"]
