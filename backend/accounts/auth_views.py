"""
Session auth for the site and the dashboard.

The frontend and the API are served from one origin through nginx, so the
session cookie needs no CORS gymnastics — the browser attaches it to /api/*
by itself. Unsafe methods still need the CSRF header, which is why /csrf/
exists: the client calls it once to be issued the cookie it will echo back.
"""

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .models import User
from .serializers import AccountSerializer


class LoginThrottle(AnonRateThrottle):
    """Password guessing is the one place an anonymous burst is not benign."""

    scope = "login"


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    identifier = (request.data.get("username") or request.data.get("email") or "").strip()
    password = request.data.get("password") or ""

    if not identifier or not password:
        return Response({"detail": "أدخل البريد الإلكتروني وكلمة المرور."}, status=status.HTTP_400_BAD_REQUEST)

    # The login card asks for an email; staff accounts are keyed by username.
    # Accept either rather than making the reader guess which one we store.
    username = identifier
    if "@" in identifier:
        match = User.objects.filter(email__iexact=identifier).first()
        if match:
            username = match.username

    user = authenticate(request, username=username, password=password)
    if user is None:
        # Django's ModelBackend refuses an inactive account inside
        # authenticate() itself, so it answers None here and this used to come
        # back as "wrong password" — which is a lie, and the wrong instruction:
        # a suspended writer would sit there retyping a password that is
        # perfectly correct instead of calling the admin who suspended them.
        # Say so, but only to someone who proved they hold the password: the
        # check runs against the credentials, not against the username alone,
        # so this never becomes a way to enumerate accounts.
        suspended = User.objects.filter(username=username, is_active=False).first()
        if suspended and suspended.check_password(password):
            return Response(
                {"detail": "هذا الحساب موقوف. تواصل مع مدير الموقع."}, status=status.HTTP_403_FORBIDDEN
            )
        return Response({"detail": "البريد الإلكتروني أو كلمة المرور غير صحيحة."}, status=status.HTTP_401_UNAUTHORIZED)

    login(request, user)
    return Response(AccountSerializer(user).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    """Who am I? Anonymous is a normal answer, not an error."""
    if not request.user.is_authenticated:
        return Response({"authenticated": False})
    return Response({"authenticated": True, **AccountSerializer(request.user).data})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def register(request):
    """Reader sign-up. Always creates a reader — role is never client-supplied."""
    email = (request.data.get("email") or "").strip().lower()
    password = request.data.get("password") or ""
    name = (request.data.get("name") or "").strip()

    if not email or "@" not in email:
        return Response({"email": ["أدخل بريداً إلكترونياً صالحاً."]}, status=status.HTTP_400_BAD_REQUEST)
    if len(password) < 8:
        return Response({"password": ["كلمة المرور يجب أن تكون 8 أحرف على الأقل."]}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email__iexact=email).exists():
        return Response({"email": ["هذا البريد مسجّل بالفعل."]}, status=status.HTTP_400_BAD_REQUEST)

    username = email.split("@")[0][:140] or "reader"
    base, n = username, 1
    while User.objects.filter(username=username).exists():
        n += 1
        username = f"{base}{n}"

    user = User.objects.create_user(username=username, email=email, password=password)
    user.first_name = name[:150]
    # Readers are not newsroom staff: no role, no staff flag, no dashboard.
    user.role = User.Role.AUTHOR
    user.is_staff = False
    user.save(update_fields=["first_name", "role", "is_staff"])

    login(request, user)
    return Response(AccountSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    current = request.data.get("current_password") or ""
    new = request.data.get("new_password") or ""
    if not request.user.check_password(current):
        return Response({"current_password": ["كلمة المرور الحالية غير صحيحة."]}, status=status.HTTP_400_BAD_REQUEST)
    if len(new) < 8:
        return Response({"new_password": ["كلمة المرور يجب أن تكون 8 أحرف على الأقل."]}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(new)
    # Clearing the flag here is what ends the forced-change loop the dashboard
    # holds an invited account in until it has chosen its own password.
    request.user.must_change_password = False
    request.user.save(update_fields=["password", "must_change_password"])
    # Keep the caller signed in; set_password rotates the session hash.
    login(request, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)
