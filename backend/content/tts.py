"""
Narration for the «استمع للمقال» player — shared by the `generate_tts`
management command (bulk/backfill) and the dashboard's one-article action
(ArticleViewSet.generate_tts), so the two never drift into two different
scripts producing two different-sounding results.

Voices come from edge-tts, which reaches Microsoft's neural endpoint with no
API key and carries genuine Egyptian Arabic voices (ar-EG-SalmaNeural) rather
than the Modern-Standard reading most engines give an Egyptian newsroom. That
endpoint is not a contracted API: it can rate-limit or change, so a failure
here must leave the article's previous file (if any) alone rather than
blanking a working narration — see generate_for_article's except clause.
"""

import asyncio
import io

import edge_tts
from django.core.files.base import ContentFile
from mutagen.mp3 import MP3

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


class TtsError(Exception):
    """Raised with a message safe to show an editor (no body to read, etc.)."""


def generate_for_article(article):
    """
    Synthesize narration for one article and save it — used synchronously
    from the dashboard action, so this runs the whole request/response cycle
    (a few seconds for a typical article) rather than queuing a job.

    Raises TtsError on anything that stops a narration existing; the caller
    (view or command) decides how to report it. `article.tts_status` is left
    "idle" on failure — never "generating" — so a failed attempt doesn't get
    stuck showing a spinner forever.
    """
    text = script_for(article)
    if len(text) < 20:
        raise TtsError("لا يوجد نص كافٍ في المقال لتحويله إلى صوت.")

    voice = VOICES.get(article.language, VOICES["ar"])
    type(article).objects.filter(pk=article.pk).update(tts_status="generating")
    try:
        audio = asyncio.run(synthesize(text, voice))
        if not audio:
            raise TtsError("لم يُرجع محرك الصوت أي بيانات — حاول مرة أخرى.")
        seconds = int(round(MP3(io.BytesIO(audio)).info.length))

        article.tts_audio.save(f"{article.pk}.mp3", ContentFile(audio), save=False)
        article.tts_duration_seconds = seconds
        article.tts_status = "done"
        article.save(update_fields=["tts_audio", "tts_duration_seconds", "tts_status"])
        return seconds
    except TtsError:
        type(article).objects.filter(pk=article.pk).update(tts_status="idle")
        raise
    except Exception as exc:  # noqa: BLE001 — surfaced as TtsError, one bad article must not 500
        type(article).objects.filter(pk=article.pk).update(tts_status="idle")
        raise TtsError(f"تعذّر توليد الصوت: {exc}") from exc
