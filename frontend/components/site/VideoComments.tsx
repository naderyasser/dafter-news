"use client";

import { useState } from "react";

import { apiMutate, describeApiError } from "@/lib/api";
import type { VideoComment } from "@/lib/types";
import { AR_LOCALE } from "@/lib/format";

const T = {
  ar: {
    heading: (n: number) => `التعليقات (${n})`,
    placeholder: "أضف تعليقاً...",
    post: "نشر",
    you: "أنت",
    failed: "تعذّر نشر التعليق. تحقّق من الاتصال ثم حاول مرة أخرى.",
    dateLocale: AR_LOCALE,
    font: "font-display-ar",
  },
  en: {
    heading: (n: number) => `Comments (${n})`,
    placeholder: "Add a comment...",
    post: "Post",
    you: "You",
    failed: "Could not post the comment. Check your connection and try again.",
    dateLocale: "en-US",
    font: "font-display-en",
  },
};

export default function VideoComments({
  lang = "ar",
  videoId,
  initial,
}: {
  lang?: "ar" | "en";
  videoId: number;
  initial: VideoComment[];
}) {
  const t = T[lang];
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      const created = await apiMutate<VideoComment>("/video-comments/", "POST", { video: videoId, name: t.you, text });
      setComments((c) => [created, ...c]);
      setDraft("");
    } catch (err) {
      // Never fabricate a local row here: the comment was not persisted, so
      // showing it as posted would vanish on refresh and mislead the reader.
      setError(describeApiError(err, t.failed));
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <div className="mb-4 rule-accent ps-3.5">
        <h2 className={`${t.font} m-0 text-h3 font-extrabold text-ink`}>{t.heading(comments.length)}</h2>
      </div>
      {error ? (
        <div role="alert" className="mb-4 rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
          {error}
        </div>
      ) : null}
      <div className="mb-6 flex gap-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.placeholder}
          className="min-h-[44px] flex-1 resize-y rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={posting}
          className="flex-shrink-0 rounded-lg bg-brand px-5 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60"
        >
          {t.post}
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {comments.map((cm) => (
          <div key={cm.id} className="flex gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold text-ink-2">
              {cm.initial}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-bold text-ink">{cm.name}</span>
                <span className="text-xs text-ink-3">{new Date(cm.created_at).toLocaleDateString(t.dateLocale)}</span>
              </div>
              <p className="mt-1 text-[14px] leading-[1.6] text-ink-2">{cm.text}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
