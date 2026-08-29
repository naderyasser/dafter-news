"""
Django settings for the Al Daftar News (الدفتر نيوز) project.

Backs the public bilingual (AR RTL / EN LTR) news site and its admin
dashboard, per the Claude Design handoff brief in ../README.md and
../chats/chat1.md.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-insecure-secret-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_filters",
    "corsheaders",
    "accounts",
    "content",
    "media_library",
    "video",
    "ads",
    "market",
    "siteconfig",
    "integrations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "aldaftar.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "aldaftar.wsgi.application"
ASGI_APPLICATION = "aldaftar.asgi.application"

AUTH_USER_MODEL = "accounts.User"

# Use Postgres when POSTGRES_DB is set, otherwise fall back to sqlite for
# quick local runs / CI without a database service.
if os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", "aldaftar"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Two site languages per the brief (§4): Arabic (RTL, default) and English.
LANGUAGE_CODE = "ar"
TIME_ZONE = "Africa/Cairo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    # Client-controlled page size: the frontend asks for exactly what each
    # grid renders (?page_size=4 for a section block, 50 for a dashboard
    # table). Without page_size_query_param DRF silently ignores those and
    # serves 20 rows everywhere. Capped so a caller can't request the world.
    "DEFAULT_PAGINATION_CLASS": "aldaftar.pagination.ConfigurablePageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    # PROTECT-blocked deletes are a client-side conflict, not a server fault.
    "EXCEPTION_HANDLER": "aldaftar.exceptions.exception_handler",
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        # Password guessing and sign-up spam are the two anonymous bursts that
        # are never legitimate. Reads stay unthrottled: this is a news site.
        "login": "10/min",
        # One beacon per browser session is the honest rate; 30/min per IP
        # absorbs a newsroom behind one NAT while keeping a curl loop from
        # minting a million-visit day.
        "visits": "30/min",
        # Per-article read beacons. Higher than "visits" because this one
        # fires per article rather than per session — a reader working
        # through a dozen stories, and a whole office behind one NAT doing
        # the same, must not be throttled out of the count. Still low enough
        # that a script cannot inflate a story into «الأكثر قراءة».
        "article_views": "120/min",
    },
}

# The site and the API share one origin behind nginx, so the session cookie
# rides along on its own. Django still needs the HTTPS origin listed before it
# will accept a CSRF token on an unsafe method.
# ---------------------------------------------------------------- email
# There is no MTA on this host, so Django's default (SMTP on localhost:25)
# would raise on every send. Point EMAIL_HOST at a real relay — a provider
# mailbox, SES, Postmark — and set the credentials below.
#
# Until EMAIL_HOST is set the console backend is used: mail is written to the
# service log instead of vanishing into a connection error, so a password
# reset is still recoverable by an operator reading `journalctl`.
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@aldaftarnews.com")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", f"الدفتر نيوز <{ADMIN_EMAIL}>")
SERVER_EMAIL = ADMIN_EMAIL
ADMINS = [("Al Daftar admin", ADMIN_EMAIL)]

EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") == "1"
    EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "0") == "1"
    EMAIL_TIMEOUT = 15
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "https://aldaftarnews.com").split(",") if o.strip()
]
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# The client must read the CSRF cookie to echo it back in the header.
CSRF_COOKIE_HTTPONLY = False
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# The dev frontend runs on 3891, not 3000 — 3000 belongs to another service on
# this host (see start.sh). Both localhost and 127.0.0.1 are listed because a
# browser treats them as different origins, and which one you land on depends
# on how you opened the page.
_DEV_ORIGINS = [
    "http://localhost:3891",
    "http://127.0.0.1:3891",
]
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", ",".join(_DEV_ORIGINS)).split(",") if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
# Session login posts a CSRF token cross-origin in development, so the dev
# origins have to be trusted as well or every dashboard write 403s.
if DEBUG:
    CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(CSRF_TRUSTED_ORIGINS + _DEV_ORIGINS))
