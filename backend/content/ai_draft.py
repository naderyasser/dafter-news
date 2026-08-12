"""
«توليد بالذكاء الاصطناعي» — the dashboard editor's AI-assisted drafting
button. Codebase-wide search turned up no prior AI content-generation
feature (only «الاستماع للمقال»'s TTS, which is unrelated and already
works — see tts.py); this is a new build.

Same posture as import_url.py's «استيراد من رابط»: this never creates or
publishes an Article, it only returns a starting draft's fields for the
editor to load into the form above, review, fact-check and rewrite before
saving. An AI draft is not a source — the model can invent specifics
(numbers, quotes, names) that read as confident and are wrong, which is
why the prompt below asks it to flag anything it isn't sure of rather than
paper over the gap.

Uses the Anthropic Messages API directly (structured JSON output via
output_config.format — no tool-use loop needed for a one-shot draft).
ANTHROPIC_API_KEY follows the same "read from the environment, fail with a
clear Arabic message if unset" pattern as the other external integrations
(see integrations/providers/*.py) rather than a Django setting, so it's a
plain env var to add in production with no code change.
"""

import json
import os

import anthropic

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5")

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string", "description": "عنوان الخبر — جملة واحدة واضحة"},
        "standfirst": {"type": "string", "description": "مقدمة موجزة (سطر إلى سطرين) تلخص الخبر"},
        "paragraphs": {
            "type": "array",
            "items": {"type": "string"},
            "description": "فقرات متن الخبر، فقرة لكل عنصر",
        },
    },
    "required": ["title", "standfirst", "paragraphs"],
    "additionalProperties": False,
}

SYSTEM = {
    "ar": (
        "أنت محرر مساعد في غرفة أخبار عربية (الدفتر نيوز). تكتب مسودة أولى لخبر "
        "بأسلوب صحفي مصري/عربي مباشر وواضح، بالفصحى المعاصرة، بلا مبالغة أو رأي شخصي. "
        "هذه مسودة يراجعها محرر بشري قبل النشر — لا تخترع أرقاماً أو تصريحات أو أسماء "
        "محددة لا يوفرها الموجز؛ إن احتجت تفصيلاً غير متوفر فاكتب الجملة بصياغة عامة أو "
        "ضع بين قوسين [يحتاج تأكيد] بدل افتراض رقم أو اسم. أعد العنوان والمقدمة ثم "
        "فقرات المتن، كل فقرة عنصر مستقل."
    ),
    "en": (
        "You are an assistant editor at an Arabic newsroom (Al Daftar News) writing "
        "an English-language draft. Write a plain, direct news style with no "
        "editorializing. This is a first draft a human editor reviews before "
        "publication — never invent specific numbers, quotes, or names the brief "
        "doesn't give you; where a detail is missing, write generically or mark it "
        "[needs confirmation] instead of guessing. Return a title, a short "
        "standfirst, then body paragraphs, one per array item."
    ),
}


class AiDraftError(Exception):
    """Raised with a message safe to show an editor."""


def generate_draft(topic: str, language: str = "ar") -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise AiDraftError("لم يتم إعداد مفتاح الذكاء الاصطناعي (ANTHROPIC_API_KEY) على الخادم.")

    lang = language if language in SYSTEM else "ar"
    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM[lang],
            messages=[{"role": "user", "content": topic.strip()}],
            output_config={"format": {"type": "json_schema", "schema": DRAFT_SCHEMA}},
        )
    except anthropic.AuthenticationError as exc:
        raise AiDraftError("مفتاح الذكاء الاصطناعي غير صالح.") from exc
    except anthropic.RateLimitError as exc:
        raise AiDraftError("تم تجاوز حد الاستخدام المسموح به — حاول لاحقاً.") from exc
    except anthropic.APIStatusError as exc:
        raise AiDraftError(f"تعذّر توليد المسودة: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise AiDraftError("تعذّر الاتصال بخدمة الذكاء الاصطناعي.") from exc

    if response.stop_reason == "refusal":
        raise AiDraftError("رفض النظام توليد محتوى لهذا الموضوع.")

    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        raise AiDraftError("لم يُرجع النظام أي نص.")
    data = json.loads(text)

    return {
        "title": (data.get("title") or "").strip(),
        "standfirst": (data.get("standfirst") or "").strip(),
        "paragraphs": [p.strip() for p in data.get("paragraphs") or [] if p and p.strip()],
    }
