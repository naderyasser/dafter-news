from django.db.models import F
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from aldaftar.permissions import ReadOnlyOrAdmin, ReadOnlyOrEditor, StaffOnly
from .models import DailyVisit, SiteSettings, SocialLink, WelcomeAlert
from .serializers import (
    DailyVisitSerializer,
    SiteSettingsSerializer,
    SocialLinkSerializer,
    WelcomeAlertSerializer,
)


class SiteSettingsView(APIView):
    """
    GET/PUT /api/settings/ — DashSettings.dc.html single-record form.

    Read stays public (the header, footer and <title> of every page are built
    from it). Writing is admin-only: this one record carries the site name, the
    SEO title and description that go out on every page, and the toggles that
    switch a whole language edition off. Under the newsroom-wide ReadOnlyOrStaff
    it used to sit behind, a comment moderator could rename the paper and
    rewrite its search listing — a blast radius nothing else on the staff side
    comes close to. Accounts already draw the same line (see UserViewSet).
    """

    permission_classes = [ReadOnlyOrAdmin]

    def get(self, request):
        return Response(SiteSettingsSerializer(SiteSettings.load()).data)

    def put(self, request):
        settings_obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SocialLinkViewSet(viewsets.ModelViewSet):
    """The paper's own accounts — its identity, like the settings above it,
    and the same admin-only line for the same reason: these links are printed
    in the footer of every page and in the Organization schema search engines
    read the newsroom's identity from."""

    queryset = SocialLink.objects.all()
    serializer_class = SocialLinkSerializer
    permission_classes = [ReadOnlyOrAdmin]


class DailyVisitViewSet(viewsets.ModelViewSet):
    queryset = DailyVisit.objects.all()
    serializer_class = DailyVisitSerializer
    # StaffOnly, same reasoning as /api/ads/: traffic-by-day is a commercial
    # figure, no public page reads it (the overview endpoint queries the
    # model directly), and now that the counter is real it is no longer
    # seeded set-dressing but the site's actual audience curve.
    permission_classes = [StaffOnly]


class VisitTrackView(APIView):
    """
    POST /api/visits/track/ — the beacon that makes «زيارات اليوم» real.

    The overview's four stat cards and 7-day chart always read DailyVisit;
    the only writer was the demo seed, so the number the owner checked every
    morning was fiction. VisitBeacon (SiteShell) fires this once per browser
    session; each hit is one increment on today's row.

    No authentication classes at all, quite deliberately: with Session auth
    in the list, a signed-in editor browsing the public site would fail CSRF
    here and silently drop out of the count. The view reads nothing from the
    caller — no body, no identity, nothing echoed back — so there is nothing
    for CSRF to protect. Scoped throttling keeps a curl loop from minting a
    million-visit day; beyond that, gaming a visit counter you own buys you
    nothing.
    """

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "visits"

    def post(self, request):
        today = timezone.localdate()
        DailyVisit.objects.get_or_create(date=today)
        # F() so two beacons landing together both count — read-modify-write
        # in Python would lose one to the race.
        DailyVisit.objects.filter(date=today).update(visits=F("visits") + 1)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WelcomeAlertView(APIView):
    """GET/PUT /api/welcome-alert/ — the on-load modal. Editor+, literally as
    the docstring always claimed: it interrupts every reader on the site."""

    permission_classes = [ReadOnlyOrEditor]

    def get(self, request):
        return Response(WelcomeAlertSerializer(WelcomeAlert.load()).data)

    def put(self, request):
        alert = WelcomeAlert.load()
        serializer = WelcomeAlertSerializer(alert, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
