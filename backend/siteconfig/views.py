from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DailyVisit, SiteSettings, SocialLink, WelcomeAlert
from .serializers import (
    DailyVisitSerializer,
    SiteSettingsSerializer,
    SocialLinkSerializer,
    WelcomeAlertSerializer,
)


class SiteSettingsView(APIView):
    """GET/PUT /api/settings/ — DashSettings.dc.html single-record form."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def put(self, request):
        settings_obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SocialLinkViewSet(viewsets.ModelViewSet):
    queryset = SocialLink.objects.all()
    serializer_class = SocialLinkSerializer
    permission_classes = [AllowAny]


class DailyVisitViewSet(viewsets.ModelViewSet):
    queryset = DailyVisit.objects.all()
    serializer_class = DailyVisitSerializer
    permission_classes = [AllowAny]


class WelcomeAlertView(APIView):
    """GET/PUT /api/welcome-alert/ — the on-load modal, editor-controlled."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response(WelcomeAlertSerializer(WelcomeAlert.load()).data)

    def put(self, request):
        alert = WelcomeAlert.load()
        serializer = WelcomeAlertSerializer(alert, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
