# الدفتر نيوز — implementation

Full-stack implementation of the Claude Design handoff in `project/` (see
`README.md` and `chats/chat1.md` for the original design brief and intent).

- **Backend**: Django 5 + Django REST Framework + Postgres (`backend/`)
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS (`frontend/`)

All 33 designed pages are implemented and wired to a real API with seeded
demo data: 19 Arabic public pages, English Home + Article, and all 14
admin dashboard pages.

## Running it

### Backend

```sh
cd backend
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit POSTGRES_* if you want Postgres; omitting
                        # POSTGRES_DB falls back to sqlite for a quick run
python manage.py migrate
python manage.py seed_demo_data   # populates real demo content
python manage.py createsuperuser  # optional, for /admin/
python manage.py runserver 0.0.0.0:8000
```

API root: `http://localhost:8000/api/` · Django admin: `/admin/`

### Frontend

```sh
cd frontend
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL, defaults to :8000
npm run dev
```

Site: `http://localhost:3000/` · Dashboard: `http://localhost:3000/dashboard`

## Tests

```sh
cd backend  && . .venv/bin/activate && python manage.py test   # 113 tests
cd frontend && npm test                                        # 96 tests
```

**Backend (113)** — model behaviour (unicode slug derivation, read-time
maths, CTR, duration labels, the settings singleton), serializers, and the
API surface (filters, published-only defaults, slug-or-id lookup,
pagination stability, every dashboard write path).

**Frontend (96)** — `lib/format.ts` and `lib/api.ts` (param decoding, slug
encoding, graceful degradation when the API is down), plus the
presentational components (`ArticleCard` in all four variants,
`StatusBadge`, `StatCard`, `MostReadList`, `MarketsTicker`).

Tests double as executable specification for the brief's hard rules: that
market movement uses the up/down tokens and never the brand red (§10.3),
that data figures carry `tabular-nums` (§3), that ranked Arabic lists use
Eastern numerals (§3), that the ▶ glyph mirrors in RTL (§4), and that badge
placement uses logical properties rather than left/right (§4).

Cases fixing a previously-shipped defect are marked `regression:` in their
docstring, so it's clear why an odd-looking assertion matters.

## التشغيل السريع

```sh
git clone https://github.com/naderyasser/dafter-news.git
cd dafter-news
./start.sh
```

يجهّز البيئة الافتراضية والحزم وقاعدة البيانات والبيانات التجريبية ثم يشغّل
الخادمين. آمن للتكرار — كل خطوة تتخطى نفسها لو خلصت قبل كده.

- الموقع: http://localhost:3000
- لوحة التحكم: http://localhost:3000/dashboard
- الـAPI: http://localhost:8000/api/

`./start.sh --check` يجهّز، يتأكد أن الصفحات تستجيب، ثم يخرج (للـCI).

`.venv` و`node_modules` وقاعدة البيانات غير مرفوعة على git عمداً — لذلك لا
يعمل المشروع بمجرد الاستنساخ حتى تشغّل السكربت مرة واحدة.

## External data feeds

Six sources keep the ticker, weather, prayer times, match results and the
wire rail current:

| Source | Provider | Key | Why this one |
|---|---|---|---|
| العملات | exchangerate.host | — | keyless, commercial use allowed |
| الذهب | gold-api.com | — | converts spot XAU to EGP per karat |
| الطقس | OpenWeatherMap | required | free tier allows commercial use; Open-Meteo's does not |
| مواقيت الصلاة | AlAdhan | — | keyless; method 5 = Egyptian General Authority of Survey |
| المباريات | TheSportsDB | optional | covers the Egyptian league; football-data.org's free tier doesn't |
| الأخبار | NewsData.io | required | production use allowed; NewsAPI.org's free plan is dev-only |

```sh
python manage.py sync_feeds                  # all sources
python manage.py sync_feeds --only currency,gold
python manage.py sync_feeds --skip newswire
```

Run it on a cron (every minute is fine — it's one call per source, not per
visitor; readers always read the database).

```
* * * * * cd /path/to/backend && .venv/bin/python manage.py sync_feeds
```

**Failure behaviour is the point of the design.** Every source is isolated:
one provider timing out, returning junk, or having no key configured never
stops the others and never blanks what's already stored. A dead feed leaves
yesterday's dollar rate on screen — recoverable — rather than an empty bar,
which reads as a broken site. `SyncLog` records per-source status, last
successful sync and a failure streak, surfaced at **/dashboard/feeds** with
the age of the data as the primary column.

Wire stories land in `WireArticle`, never in `Article`: that copy belongs to
whoever filed it, so it surfaces with the source credited and a link out
rather than silently becoming الدفتر نيوز content.

## What's real vs. presentational

- All content (articles, sections, tags, videos, live coverage, ads,
  currencies/gold/weather, comments, users, site settings) is served from
  the Django API and seeded with the same demo copy used in the design
  mocks — nothing is hardcoded in the frontend.
- Dashboard interactions (publish/delete articles, moderate comments,
  toggle ad placements/ticker modules, reorder breaking news, add live
  updates/video comments, create users, save settings) call real DRF
  endpoints.
- **Login/auth is presentational only** — the design brief's public site
  scope didn't call for a full auth flow, and it was later dropped from
  the single-file publish variant entirely. The `/login` page matches the
  design pixel-for-pixel but doesn't create a session; wiring real
  auth (e.g. session or token login against `accounts.User`) is a
  natural next step if needed.
- "الأكثر تعليقاً" (most-commented) ordering, most-read rankings, and the
  markets sparkline are computed from real seeded data, not mocked
  strings — a genuine improvement over the original static prototype.
- `AlDaftar-Deck.dc.html` and `AlDaftar-Publish.dc.html` were intentionally
  **not** reimplemented — the chat transcript shows both are export
  artifacts of the design tool itself (a slide deck and a single-file
  publish bundle), not distinct product pages.
