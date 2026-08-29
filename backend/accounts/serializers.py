from rest_framework import serializers

from .models import Follow, SavedArticle, User


class AuthorSerializer(serializers.ModelSerializer):
    """
    Public-facing author card (Authors.dc.html / AuthorPage.dc.html) and the
    write shape behind the dashboard's «كتّاب الرأي» panel.

    `name` is read-only and derived from first/last name, so the dashboard
    sends `first_name`/`last_name` to rename someone. Both are write-only
    here to keep the public payload the same shape it has always been.
    """

    name = serializers.CharField(source="display_name", read_only=True)
    initial = serializers.CharField(read_only=True)
    article_count = serializers.SerializerMethodField()
    opinion_count = serializers.SerializerMethodField()
    first_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    last_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    # Only needed on create; PATCHes from the panel leave it out.
    username = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "name_en", "first_name", "last_name", "initial", "bio", "title",
            "avatar", "is_hidden", "article_count", "opinion_count", "date_joined",
        ]

    def get_article_count(self, obj):
        return obj.articles.filter(status="published").count()

    def get_opinion_count(self, obj):
        """What the «بالعقل والمنطق» card counts — opinion pieces, not bylines."""
        return obj.articles.filter(kind="opinion").count()

    def create(self, validated_data):
        # A columnist created from the dashboard is an author account with no
        # usable password — same posture as UserCreateSerializer, so the row
        # can't be signed into until someone runs a set/reset flow.
        validated_data.setdefault("role", User.Role.AUTHOR)
        user = User(**validated_data)
        user.set_unusable_password()
        user.save()
        return user

    def validate_username(self, value):
        qs = User.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("اسم المستخدم مأخوذ بالفعل.")
        return value


class UserSerializer(serializers.ModelSerializer):
    """Dashboard row (DashUsers.dc.html)."""

    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "email", "role", "last_login", "is_active", "date_joined",
            "must_change_password", "is_staff",
        ]
        read_only_fields = ["must_change_password"]
        extra_kwargs = {
            # Writable, and only an admin can reach this endpoint at all
            # (UserViewSet is AdminOnly). It is the switch that turns a
            # byline-only columnist row — the shape every seeded writer on
            # this site has — into an account that can open the dashboard.
            # Without it those writers could never be given access from the
            # interface, only from the Django shell.
            "is_staff": {"required": False},
        }

    def update(self, instance, validated_data):
        """
        Role is what changes here; dashboard access is not revoked by it.

        This used to recompute `is_staff = role != AUTHOR` on every role
        change, which quietly locked an invited writer out of the dashboard
        the moment an admin set their role to كاتب — the exact role the
        client wants to hire. `is_active` is the switch for taking access
        away (see UserViewSet), and it is the one an offboarding admin
        should reach for.
        """
        return super().update(instance, validated_data)


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Inviting a team member.

    Onboarding is a temporary password, not an emailed magic link, and that is
    a deployment fact rather than a preference: this host has no MTA and
    EMAIL_HOST is unset, so Django falls back to the console backend (see
    settings.py) and an invitation "sent" by email would be written to the
    service log where the new writer will never see it. A link flow that
    silently drops every invitation is worse than no link flow. Set EMAIL_HOST
    and this can gain a "send instead of show" option; until then the admin
    reads the password out and the account is forced to replace it.

    The password is returned exactly once, in the create response, and is
    never readable again — it is stored hashed like any other.
    """

    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    temporary_password = serializers.CharField(read_only=True)
    # The response has to be a complete table row, not just the fields that
    # were posted: the dashboard splices what comes back straight into the
    # list it is already showing. Without these the new writer rendered with
    # no name and as «موقوف / منح دخول» — the exact opposite of the account
    # that was just created — until someone happened to reload the page.
    name = serializers.CharField(source="display_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "first_name", "last_name", "email", "role",
            "password", "temporary_password",
            "is_active", "is_staff", "must_change_password", "last_login", "date_joined",
        ]
        read_only_fields = ["is_active", "is_staff", "must_change_password", "last_login", "date_joined"]

    @staticmethod
    def _generate_password():
        """A password a human can read aloud once and type correctly.

        `secrets` rather than `random`, and no lookalike characters (0/O, 1/l)
        because this one gets dictated across a desk or a phone line.
        NB: UserManager.make_random_password() was removed in Django 5.1, so
        don't reach for it here.
        """
        import secrets

        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
        return "".join(secrets.choice(alphabet) for _ in range(12))

    def create(self, validated_data):
        password = (validated_data.pop("password", "") or "").strip()
        issued = password or self._generate_password()

        # Everyone created through /api/users/ is an invited team member, so
        # they get dashboard access; `role` decides what they may do once
        # inside (see aldaftar/permissions.py).
        #
        # This used to read `is_staff = role != AUTHOR`, which meant the one
        # role the client actually wanted to invite — كاتب — was created
        # unable to open a single staff-gated endpoint: they could log in and
        # then do nothing at all. Readers who sign up are also stored with
        # role=author (auth_views.register), which is why role can never be
        # the thing that grants dashboard access on its own.
        validated_data["is_staff"] = True
        user = User(**validated_data)
        user.set_password(issued)
        # A password someone else chose is a password to replace on arrival.
        user.must_change_password = True
        user.save()

        # Read once by the dashboard, then gone. Attached to the instance
        # rather than stored, so it cannot leak from a later GET.
        user.temporary_password = issued
        return user


class AccountSerializer(serializers.ModelSerializer):
    """
    The signed-in caller's own record — what /auth/me/ and login return.

    `permissions` is the same policy the API enforces, published so the
    dashboard can hide what it would refuse anyway. It is a convenience for
    the interface, never the enforcement: the frontend can only ever be a
    prettier "no", and every one of these maps to a permission class in
    aldaftar/permissions.py that answers the same question server-side.
    """

    name = serializers.CharField(source="display_name", read_only=True)
    is_staff_member = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "name", "email", "role", "avatar", "is_staff_member",
            "must_change_password", "permissions",
        ]

    def get_is_staff_member(self, obj):
        """Drives the dashboard link in the header — staff flag, not role text."""
        return bool(obj.is_staff or obj.is_superuser)

    def get_permissions(self, obj):
        return {
            "articles": obj.can_write_articles,
            "media": obj.can_write_articles,
            "comments": obj.can_moderate_comments,
            "taxonomy": obj.is_editorial,
            "videos": obj.is_editorial,
            "breaking": obj.is_editorial,
            "ads": obj.is_editorial,
            "ticker": obj.is_editorial,
            "feeds": obj.is_editorial,
            "authors": obj.is_editorial,
            "users": obj.is_newsroom_admin,
            "settings": obj.is_newsroom_admin,
        }


class FollowSerializer(serializers.ModelSerializer):
    section_key = serializers.CharField(source="section.key", read_only=True)
    section_name = serializers.CharField(source="section.name_ar", read_only=True)
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)

    class Meta:
        model = Follow
        fields = ["id", "section", "author", "section_key", "section_name", "author_username", "author_name", "created_at"]

    def validate(self, attrs):
        # A PATCH only carries the keys the caller actually sent — falling
        # back to the *existing* instance for anything missing means we
        # validate the row's resulting merged state, not just the submitted
        # partial body. Without this, PATCHing just {"section": <id>} onto a
        # Follow that already has `author` set passes this check (attrs has
        # no "author" key at all) and then crashes with an IntegrityError
        # against the follow_targets_exactly_one CheckConstraint instead of
        # a clean 400.
        section = attrs["section"] if "section" in attrs else getattr(self.instance, "section", None)
        author = attrs["author"] if "author" in attrs else getattr(self.instance, "author", None)
        if bool(section) == bool(author):
            raise serializers.ValidationError("اختر قسماً أو كاتباً — واحداً فقط.")
        return attrs


class SavedArticleSerializer(serializers.ModelSerializer):
    article_title = serializers.CharField(source="article.title", read_only=True)
    article_slug = serializers.CharField(source="article.slug", read_only=True)
    cover_image = serializers.ImageField(source="article.cover_image", read_only=True)

    class Meta:
        model = SavedArticle
        fields = ["id", "article", "article_title", "article_slug", "cover_image", "created_at"]
