from django.apps import AppConfig


class VideoConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "video"
    verbose_name = "الفيديوهات"

    def ready(self) -> None:
        # Importing for the side effect of registering the receivers. Kept in
        # ready() rather than at module import: models are not loaded yet when
        # this module is first read, and signals.py imports them.
        from . import signals  # noqa: F401
