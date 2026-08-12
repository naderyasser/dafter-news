"use client";

import { useState } from "react";

import { apiMutate, describeApiError } from "@/lib/api";
import type { ImportedDraft } from "@/components/dashboard/ImportFromUrl";

type AiDraft = { title: string; standfirst: string; paragraphs: string[] };

/**
 * «توليد بالذكاء الاصطناعي» — describe a topic, get a starting draft back.
 * Same posture as ImportFromUrl right above it in the editor: this never
 * creates or publishes an Article, only fills the form fields above with a
 * draft the editor still has to fact-check and rewrite — see
 * backend/content/ai_draft.py for why that line is drawn (an AI draft is
 * not a source and can invent specifics that read as confident and are
 * wrong).
 */
export default function AiDraftGenerator({
  lang,
  onGenerated,
}: {
  lang: "ar" | "en";
  onGenerated: (draft: ImportedDraft) => void;
}) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const draft = await apiMutate<AiDraft>("/generate-draft/", "POST", { topic: topic.trim(), language: lang });
      onGenerated({ ...draft, byline: "", cover_asset_id: null, cover_image: null });
      setTopic("");
    } catch (err) {
      setError(describeApiError(err, "تعذّر توليد المسودة."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 rounded-card border border-dashed border-line-strong bg-paper p-5">
      <div className="mb-1.5 flex items-center gap-2 text-[15px] font-extrabold text-ink">
        <span aria-hidden>✨</span> توليد بالذكاء الاصطناعي
      </div>
      <p className="mb-3.5 max-w-[640px] text-[13px] leading-relaxed text-ink-3">
        اكتب موضوع الخبر أو ملخصاً موجزاً له، وسيقترح الذكاء الاصطناعي عنواناً ومقدمة ومتناً كمسودة تبدأ منها. راجع
        كل معلومة ورقم قبل النشر — المسودة قد تتضمن تفاصيل غير مؤكدة.
      </p>
      {error ? (
        <div role="alert" className="mb-3 rounded-card border border-down bg-down-tint px-4 py-2.5 text-[14px] font-semibold text-down">
          {error}
        </div>
      ) : null}
      <form onSubmit={submit} className="flex flex-wrap gap-2.5">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
          placeholder="مثال: قرار جديد لوزارة الكهرباء بخصوص تسعيرة الاستهلاك المنزلي..."
          aria-label="موضوع الخبر"
          rows={2}
          className="min-w-[240px] flex-1 resize-y rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !topic.trim()}
          className="flex-shrink-0 self-start rounded-lg bg-accent px-5 py-2.5 text-[14px] font-bold text-paper hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? "جارٍ التوليد…" : "توليد"}
        </button>
      </form>
    </div>
  );
}
