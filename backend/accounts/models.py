from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Site user / dashboard operator.

    Roles map 1:1 to StatusBadge.dc.html's role options and to §8.3.13 of
    the brief (المستخدمون والأدوار): admin / editor / author / moderator.
    Authors double as the public-facing "بالعقل والمنطق" writers and
    byline authors — Authors.dc.html / AuthorPage.dc.html read straight
    off this model rather than a separate profile table.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "مدير"
        EDITOR = "editor", "محرر"
        AUTHOR = "author", "كاتب"
        MODERATOR = "moderator", "مشرف تعليقات"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.AUTHOR)
    bio = models.CharField(max_length=280, blank=True, help_text="نبذة قصيرة تظهر في صفحة الكاتب")
    avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    title = models.CharField(max_length=120, blank=True, help_text="مثال: كاتبة اقتصادية")

    class Meta:
        ordering = ["first_name", "last_name", "username"]

    def __str__(self):
        return self.get_full_name() or self.username

    @property
    def display_name(self):
        return self.get_full_name() or self.username

    @property
    def initial(self):
        name = self.display_name.replace("د. ", "").replace("Dr. ", "")
        return name[:1] if name else "?"
