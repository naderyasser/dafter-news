from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import User
from .serializers import AuthorSerializer, UserCreateSerializer, UserSerializer


class AuthorViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/authors/ — بالعقل والمنطق writers + bylines (public)."""

    queryset = User.objects.filter(role__in=[User.Role.AUTHOR, User.Role.EDITOR]).order_by("first_name")
    serializer_class = AuthorSerializer
    permission_classes = [AllowAny]
    lookup_field = "username"
    # DRF's default lookup regex excludes '.' (reserved for format suffixes
    # like .json) — usernames here are dotted (e.g. "m.eladawy"), so widen it.
    lookup_value_regex = r"[^/]+"


class UserViewSet(viewsets.ModelViewSet):
    """/api/users/ — DashUsers.dc.html (المستخدمون والأدوار)."""

    queryset = User.objects.all().order_by("-date_joined")
    permission_classes = [AllowAny]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer
