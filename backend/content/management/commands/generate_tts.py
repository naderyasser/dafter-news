"""
Narrate articles for the «استمع للمقال» player.

The player, the model fields and the serializer were all already in place —
only the audio was missing, so every article rendered a transport with a
placeholder duration and nothing to play.

Voices come from edge-tts, which reaches Microsoft's neural endpoint with no
API key and carries genuine Egyptian Arabic voices (ar-EG-SalmaNeural /
ar-EG-ShakirNeural) rather than the Modern-Standard reading most engines give
an Egyptian newsroom. That endpoint is not a contracted API: it can rate-limit
or change, so failures mark the row idle and leave the previous file alone
instead of blanking a working narration.
"""

import asyncio
import io

import edge_tts
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from mutagen.mp3 import MP3

from content.models import Article

VOICES = {
    "ar": "ar-EG-SalmaNeural",
    "en": "en-US-JennyNeural",
}

# Long bodies are read at a slight clip; news narration at default rate drags.
RATE = "+8%"


def script_for(article):
    """Headline, standfirst, then body prose — the order a reader hears it."""
    parts = [article.title.strip()]
    if article.standfirst:
        parts.append(article.standfirst.strip())
    for block in article.blocks.all().order_by("order", "id"):
        if block.type in ("paragraph", "heading", "quote") and block.text:
            parts.append(block.text.strip())
    # A blank line makes the engine pause between sections.
    return "\n\n".join(p for p in parts if p)


async def synthesize(text, voice):
    buf = io.BytesIO()
    comm = edge_tts.Communicate(text, voice, rate=RATE)
    async for chunk in comm.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


class Command(BaseCommand):
    help = "Generate «استمع للمقال» narration for articles that have none."

    def add_arguments(self, parser):
        parser.add_argument("--all", action="store_true", help="Regenerate even where audio already exists.")
        parser.add_argument("--limit", type=int, default=0, help="Stop after N articles.")
        parser.add_argument("--slug", help="Only this article.")

    def handle(self, *args, **opts):
        qs = Article.objects.all().order_by("id")
        if opts.get("slug"):
            qs = qs.filter(slug=opts["slug"])
        elif not opts["all"]:
            qs = qs.filter(tts_audio="")
        if opts["limit"]:
            qs = qs[: opts["limit"]]

        total = qs.count()
        self.stdout.write(f"narrating {total} article(s)")
        done = failed = skipped = 0

        for article in qs:
            text = script_for(article)
            if len(text) < 20:
                skipped += 1
                self.stdout.write(f"  skip  {article.slug[:44]} (no body to read)")
                continue

            voice = VOICES.get(article.language, VOICES["ar"])
            Article.objects.filter(pk=article.pk).update(tts_status="generating")
            try:
                audio = asyncio.run(synthesize(text, voice))
                if not audio:
                    raise RuntimeError("empty audio stream")
                seconds = int(round(MP3(io.BytesIO(audio)).info.length))

                article.tts_audio.save(f"{article.pk}.mp3", ContentFile(audio), save=False)
                article.tts_duration_seconds = seconds
                article.tts_status = "done"
                article.save(update_fields=["tts_audio", "tts_duration_seconds", "tts_status"])

                done += 1
                mins, secs = divmod(seconds, 60)
                self.stdout.write(f"  ok    {article.slug[:44]:46s} {mins}:{secs:02d}  {len(audio)//1024}kb")
            except Exception as exc:  # noqa: BLE001 — one bad article must not stop the run
                Article.objects.filter(pk=article.pk).update(tts_status="idle")
                failed += 1
                self.stderr.write(f"  FAIL  {article.slug[:44]}: {type(exc).__name__}: {exc}")

        self.stdout.write(self.style.SUCCESS(f"done={done} failed={failed} skipped={skipped}"))
