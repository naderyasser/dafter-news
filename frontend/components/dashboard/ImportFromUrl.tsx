"use client";

import { useState } from "react";

import { apiMutate, describeApiError } from "@/lib/api";

export type ImportedDraft = {
  title: string;
  standfirst: string;
  paragraphs: string[];
  byline: string;
  cover_asset_id: number | null;
  cover_image: string | null;
};

/**
 * «استيراد من رابط» — paste a link to another site's article, pull its
 * title/standfirst/body/lead image into a fresh draft to start from.
 *
 * Deliberately NOT a "clone and publish" tool: it only ever returns a
 * draft's fields for the caller to load into the editor above — nothing
 * here creates or publishes an Article, and the byline server-side always
 * comes back set to "منقول عن <domain>" rather than blank. Removing that
 * credit before publishing is something an editor has to do themselves;
 * see content/import_url.py for why that line is drawn.
 */
export default function ImportFromUrl({ onImported }: { onImported: (draft: ImportedDraft) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const draft = await apiMutate<ImportedDraft>("/import-from-url/", "POST", { url: url.trim() });
      onImported(draft);
      setUrl("");
    } catch (err) {
      setError(describeApiError(err, "تعذّر استيراد المحتوى من هذا الرابط."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-5 rounded-card border border-dashed border-line-strong bg-paper p-5">
      <div className="mb-1.5 flex items-center gap-2 text-[14px] font-extrabold text-ink">
        <span aria-hidden>🔗</span> استيراد خبر من رابط
      </div>
      <p className="mb-3.5 max-w-[640px] text-[12px] leading-relaxed text-ink-3">
        الصق رابط خبر من موقع آخر لتعبئة العنوان والمقدمة والمتن والصورة تلقائياً كمسودة تبدأ منها. يُنسب المصدر تلقائياً
        (اسم الكاتب وحقوق الصورة) — راجع الخبر وأعد صياغته بأسلوبك قبل النشر.
      </p>
      {error ? (
        <div role="alert" className="mb-3 rounded-card border border-down bg-down-tint px-4 py-2.5 text-[13px] font-semibold text-down">
          {error}
        </div>
      ) : null}
      <form onSubmit={submit} className="flex flex-wrap gap-2.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
          dir="ltr"
          placeholder="https://example.com/news/..."
          aria-label="رابط الخبر"
          className="min-w-[240px] flex-1 rounded-lg border border-line px-3.5 py-2.5 text-start text-[13px] outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="flex-shrink-0 rounded-lg bg-accent px-5 py-2.5 text-[13px] font-bold text-paper hover:bg-accent-strong disabled:opacity-60"
        >
          {busy ? "جارٍ الاستيراد…" : "استيراد"}
        </button>
      </form>
    </div>
  );
}
