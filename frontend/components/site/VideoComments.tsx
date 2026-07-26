"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import type { VideoComment } from "@/lib/types";

export default function VideoComments({ videoId, initial }: { videoId: number; initial: VideoComment[] }) {
  const [comments, setComments] = useState(initial);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const submit = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const created = await apiMutate<VideoComment>("/video-comments/", "POST", { video: videoId, name: "أنت", text });
      setComments((c) => [created, ...c]);
      setDraft("");
    } catch {
      setComments((c) => [{ id: Date.now(), video: videoId, name: "أنت", initial: "أ", text, created_at: new Date().toISOString() }, ...c]);
      setDraft("");
    } finally {
      setPosting(false);
    }
  };

  return (
    <>
      <div className="mb-4 border-s-[3px] border-brand ps-3.5">
        <h2 className="font-display-ar m-0 text-h3 font-extrabold text-ink">التعليقات ({comments.length})</h2>
      </div>
      <div className="mb-6 flex gap-2.5">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="أضف تعليقاً..."
          className="min-h-[44px] flex-1 resize-y rounded-lg border border-line px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <button
          onClick={submit}
          disabled={posting}
          className="flex-shrink-0 rounded-lg bg-brand px-5 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60"
        >
          نشر
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
                <span className="text-xs text-ink-3">{new Date(cm.created_at).toLocaleDateString("ar-EG")}</span>
              </div>
              <p className="mt-1 text-[14px] leading-[1.6] text-ink-2">{cm.text}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
