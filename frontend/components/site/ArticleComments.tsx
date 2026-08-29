"use client";

import { useState } from "react";

import { apiMutate, describeApiError } from "@/lib/api";
import type { ArticleComment } from "@/lib/types";
import { AR_LOCALE } from "@/lib/format";

const T = {
  ar: {
    heading: (n: number) => (n ? `التعليقات (${n})` : "شارك برأيك"),
    namePlaceholder: "اسمك (اختياري)",
    placeholder: "اكتب تعليقك…",
    post: "إرسال",
    posting: "لحظة…",
    anonymous: "قارئ",
    pendingNote: "وصل تعليقك — سيظهر هنا بعد موافقة فريق التحرير.",
    failed: "تعذّر إرسال التعليق. تحقّق من الاتصال ثم حاول مرة أخرى.",
    empty: "لا توجد تعليقات بعد — كن أول من يعلّق.",
    dateLocale: AR_LOCALE,
    font: "font-display-ar",
  },
  en: {
    heading: (n: number) => (n ? `Comments (${n})` : "Join the conversation"),
    namePlaceholder: "Your name (optional)",
    placeholder: "Write a comment…",
    post: "Send",
    posting: "One moment…",
    anonymous: "Reader",
    pendingNote: "Your comment is in — it will appear here once the desk approves it.",
    failed: "Could not send the comment. Check your connection and try again.",
    empty: "No comments yet — be the first.",
    dateLocale: "en-US",
    font: "font-display-en",
  },
};

/**
 * The article's comment box — the reader half of the moderation queue the
 * dashboard already ships (DashComments). Everything upstream existed and
 * pointed at this hole: the Comment model, the public-POST permission, the
 * queue screen, the «٥ تعليق» counts on cards, the «الأكثر تعليقاً» tab. What
 * was missing was any way for a reader to write one.
 *
 * Unlike VideoComments, a submitted row does NOT join the list. Article
 * comments are moderated — the API pins every public submission to pending —
 * so painting it into the thread would show the reader a comment that
 * vanishes on refresh and "reappears" only if approved. The honest shape is a
 * confirmation that names the actual state: received, awaiting the desk.
 */
export default function ArticleComments({
  lang = "ar",
  articleId,
  initial,
}: {
  lang?: "ar" | "en";
  articleId: number;
  initial: ArticleComment[];
}) {
  const t = T[lang];
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    setError("");
    try {
      await apiMutate("/comments/", "POST", {
        article: articleId,
        user_name: name.trim() || t.anonymous,
        text,
      });
      setDraft("");
      setSent(true);
    } catch (err) {
      setError(describeApiError(err, t.failed));
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="mt-9 border-t border-line pt-7">
      <div className="mb-4 rule-accent ps-3.5">
        <h2 className={`${t.font} m-0 text-h3 font-extrabold text-ink`}>{t.heading(initial.length)}</h2>
      </div>

      {sent ? (
        <div role="status" className="mb-5 rounded-card border border-up bg-up-tint px-4 py-3 text-[13.5px] font-semibold text-up">
          {t.pendingNote}
        </div>
      ) : (
        <form onSubmit={submit} className="mb-6 flex flex-col gap-2.5">
          {error ? (
            <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
              {error}
            </div>
          ) : null}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.namePlaceholder}
            maxLength={80}
            className="w-full max-w-[320px] rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
          />
          <div className="flex gap-2.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t.placeholder}
              required
              className="min-h-[72px] flex-1 resize-y rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="flex-shrink-0 self-end rounded-lg bg-brand px-5 py-2.5 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60"
            >
              {posting ? t.posting : t.post}
            </button>
          </div>
        </form>
      )}

      {initial.length ? (
        <div className="flex flex-col gap-4">
          {initial.map((cm) => (
            <div key={cm.id} className="flex gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold text-ink-2" aria-hidden>
                {(cm.user_name || t.anonymous).trim().charAt(0)}
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[14px] font-bold text-ink">{cm.user_name || t.anonymous}</span>
                  <span className="text-xs text-ink-3">{new Date(cm.created_at).toLocaleDateString(t.dateLocale)}</span>
                </div>
                <p className="m-0 mt-1 text-[14px] leading-[1.7] text-ink-2">{cm.text}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[13.5px] text-ink-3">{t.empty}</p>
      )}
    </section>
  );
}
