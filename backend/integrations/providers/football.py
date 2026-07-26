"""
Egyptian Premier League fixtures and results.

TheSportsDB, because it covers the Egyptian Premier League on the free tier
— football-data.org's free plan carries twelve European leagues and not this
one, which makes it useless for جوّه الجون.

Both the last round's results and the next round's fixtures are pulled: the
results answer "what happened" and the fixtures answer "what's next", and a
sports rail showing only one of those feels half-built.
"""
import os
from datetime import datetime, timezone as dt_timezone

from integrations.client import ProviderError, fetch_json
from integrations.models import Match

SOURCE = "football"
LABEL = "الدوري المصري — TheSportsDB"

# 4829 is the Egyptian Premier League in TheSportsDB's league table.
LEAGUE_ID = "4829"
BASE = "https://www.thesportsdb.com/api/v1/json"

# "3" is the documented free public key; a paid key can be dropped in via
# env without touching anything else.
DEFAULT_KEY = "3"


def _parse_kickoff(date_str, time_str):
    if not date_str:
        return None
    stamp = f"{date_str} {(time_str or '00:00:00')[:8]}"
    try:
        return datetime.strptime(stamp, "%Y-%m-%d %H:%M:%S").replace(tzinfo=dt_timezone.utc)
    except (ValueError, TypeError):
        return None


def _to_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _store(events, status):
    stored = 0
    for ev in events or []:
        external_id = ev.get("idEvent")
        home = ev.get("strHomeTeam")
        away = ev.get("strAwayTeam")
        if not external_id or not home or not away:
            continue

        home_score = _to_int(ev.get("intHomeScore"))
        away_score = _to_int(ev.get("intAwayScore"))
        # A "past" event with no score hasn't actually been played yet
        # (postponed, or the feed hasn't caught up) — don't claim it finished.
        resolved = status
        if status == Match.Status.FINISHED and home_score is None:
            resolved = Match.Status.SCHEDULED

        Match.objects.update_or_create(
            external_id=str(external_id)[:80],
            defaults=dict(
                league=ev.get("strLeague") or "الدوري المصري الممتاز",
                home_team=home[:120],
                away_team=away[:120],
                home_score=home_score,
                away_score=away_score,
                status=resolved,
                kickoff_at=_parse_kickoff(ev.get("dateEvent"), ev.get("strTime")),
                round_label=(ev.get("intRound") and f"الجولة {ev['intRound']}") or "",
                venue=(ev.get("strVenue") or "")[:160],
            ),
        )
        stored += 1
    return stored


def sync():
    """Refresh recent results and upcoming fixtures. Returns rows stored."""
    key = os.environ.get("THESPORTSDB_KEY", DEFAULT_KEY)
    stored = 0
    reachable = False

    past = fetch_json(f"{BASE}/{key}/eventspastleague.php", params={"id": LEAGUE_ID})
    if past is not None:
        reachable = True
        stored += _store(past.get("events"), Match.Status.FINISHED)

    upcoming = fetch_json(f"{BASE}/{key}/eventsnextleague.php", params={"id": LEAGUE_ID})
    if upcoming is not None:
        reachable = True
        stored += _store(upcoming.get("events"), Match.Status.SCHEDULED)

    if not reachable:
        raise ProviderError("تعذّر الوصول إلى مصدر المباريات")
    # Reachable but empty is normal in the off-season, so it isn't a failure.
    return stored
