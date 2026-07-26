from django.core.management import call_command
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from aldaftar.permissions import ReadOnlyOrStaff, StaffOnly
from .models import Match, PrayerTimes, SyncLog, WireArticle
from .serializers import MatchSerializer, PrayerTimesSerializer, SyncLogSerializer, WireArticleSerializer


class WireArticleViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only on purpose: wire copy is someone else's, we only mirror it."""

    queryset = WireArticle.objects.all()
    serializer_class = WireArticleSerializer
    permission_classes = [StaffOnly]
    filterset_fields = ["provider", "language"]
    search_fields = ["title", "summary"]


class MatchViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Match.objects.all()
    serializer_class = MatchSerializer
    permission_classes = [ReadOnlyOrStaff]
    filterset_fields = ["status", "league"]
    ordering_fields = ["kickoff_at"]


class SyncLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Powers the dashboard's feed-health panel."""

    queryset = SyncLog.objects.all()
    serializer_class = SyncLogSerializer
    permission_classes = [StaffOnly]


class PrayerTimesView(APIView):
    """Today's timings for one city (?city=cairo)."""

    permission_classes = [ReadOnlyOrStaff]

    def get(self, request):
        city = request.query_params.get("city", "cairo")
        row = PrayerTimes.objects.filter(city_key=city, date=timezone.localdate()).first()
        # Fall back to the most recent day we have rather than 404ing: a
        # missed sync shouldn't blank the header.
        if row is None:
            row = PrayerTimes.objects.filter(city_key=city).first()
        if row is None:
            # DRF renders Response(None) as a zero-length body with no
            # Content-Type, which any JSON client chokes on. Emit a literal
            # `null` so "no data yet" stays parseable.
            return JsonResponse(None, safe=False)
        return Response(PrayerTimesSerializer(row).data)


class SyncNowView(APIView):
    """Manual refresh trigger for the dashboard's «تحديث الآن» button."""

    permission_classes = [StaffOnly]

    def post(self, request):
        source = request.data.get("source")
        kwargs = {"only": source} if source else {}
        call_command("sync_feeds", **kwargs)
        return Response(SyncLogSerializer(SyncLog.objects.all(), many=True).data)
