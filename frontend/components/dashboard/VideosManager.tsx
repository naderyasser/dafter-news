"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { dashMutate, dashUpload, mediaUrl } from "@/lib/api";
import type { Section, Video } from "@/lib/types";

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-brand";

export default function VideosManager({
  videos: initial,
  sections,
}: {
  videos: Video[];
  sections: Section[];
}) {
  const [videos, setVideos] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const toggle = async (id: number, key: "is_live" | "is_exclusive") => {
    const v = videos.find((x) => x.id === id);
    if (!v) return;
    const next = !v[key];
    const before = videos;
    setVideos((vs) => vs.map((x) => (x.id === id ? { ...x, [key]: next } : x)));
    try {
      await dashMutate(`/videos/${id}/`, "PATCH", { [key]: next });
    } catch {
      setVideos(before);
      setError("تعذّر تحديث الفيديو.");
    }
  };

  const remove = async (v: Video) => {
    if (!confirm(`حذف «${v.title}» نهائياً؟`)) return;
    const before = videos;
    setVideos((vs) => vs.filter((x) => x.id !== v.id));
    try {
      await dashMutate(`/videos/${v.id}/`, "DELETE");
    } catch {
      setVideos(before);
      setError("تعذّر حذف الفيديو.");
    }
  };

  const chip = (active: boolean, color: "live" | "gold") =>
    `rounded-pill border px-3 py-1 text-[11.5px] font-bold ${
      active
        ? color === "live"
          ? "border-badge-breaking bg-badge-breaking text-paper"
          : "border-gold bg-gold text-paper"
        : "border-line bg-paper text-ink"
    }`;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-ink-3">{videos.length} فيديو</span>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-brand px-4.5 py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong"
        >
          ⬆ رفع فيديو جديد
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {videos.map((v) => (
          <div key={v.id} className="overflow-hidden rounded-card border border-line bg-paper">
            {/* The card opens the video's own page — that's the point of the
                grid, and it used to go nowhere. */}
            <Link href={`/video/${v.slug}`} className="relative block aspect-video bg-surface-2 no-underline">
              {v.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(v.cover_image)} alt={v.title} className="h-full w-full object-cover" />
              ) : null}
              <span className="tnum absolute bottom-2 start-2 rounded-badge bg-[rgba(23,26,31,.75)] px-1.5 py-0.5 text-xs text-paper">
                {v.duration_label}
              </span>
            </Link>
            <div className="p-3.5">
              <Link
                href={`/video/${v.slug}`}
                className="mb-2 line-clamp-2 block text-[13.5px] font-bold leading-[1.5] text-ink no-underline hover:text-brand"
              >
                {v.title}
              </Link>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                <button onClick={() => toggle(v.id, "is_live")} className={chip(v.is_live, "live")}>
                  مباشر
                </button>
                <button onClick={() => toggle(v.id, "is_exclusive")} className={chip(v.is_exclusive, "gold")}>
                  خاص
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>💬 {v.comment_count} تعليق</span>
                <div className="flex gap-3">
                  <Link href="/dashboard/comments" className="font-bold text-brand no-underline">
                    التعليقات
                  </Link>
                  <button onClick={() => remove(v)} className="font-bold text-down">
                    مسح
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {videos.length === 0 && <div className="col-span-full p-8 text-center text-ui text-ink-3">لا توجد فيديوهات بعد</div>}
      </div>

      {adding && (
        <UploadDialog
          sections={sections}
          onCancel={() => setAdding(false)}
          onCreated={(v) => {
            setVideos((vs) => [v, ...vs]);
            setAdding(false);
          }}
          onError={setError}
        />
      )}
    </>
  );
}

function UploadDialog({
  sections,
  onCancel,
  onCreated,
  onError,
}: {
  sections: Section[];
  onCancel: () => void;
  onCreated: (v: Video) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [isExclusive, setIsExclusive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Either a file or a link — a video with neither has nothing to play.
  const canSave = title.trim().length > 0 && (!!file || externalUrl.trim().length > 0) && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      const duration = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
      // Multipart throughout: one request carries the video and its cover, so
      // there's no half-created row if a second upload were to fail.
      const form = new FormData();
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("duration_seconds", String(duration));
      form.append("is_exclusive", String(isExclusive));
      if (sectionId) form.append("section", sectionId);
      if (externalUrl.trim()) form.append("external_url", externalUrl.trim());
      if (file) form.append("file", file);
      if (cover) form.append("cover_image", cover);
      onCreated(await dashUpload<Video>("/videos/", "POST", form));
    } catch {
      onError("تعذّر رفع الفيديو. تأكد من الملف أو الرابط وحاول مرة أخرى.");
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,11,13,.55)] p-4" onClick={onCancel} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="رفع فيديو جديد"
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-full w-full max-w-[520px] overflow-y-auto rounded-card bg-paper p-5 shadow-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">رفع فيديو جديد</span>
          <button onClick={onCancel} aria-label="إغلاق" className="text-[18px] leading-none text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">العنوان</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">الوصف</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} min-h-[64px] resize-y`} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">القسم</span>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className={input}>
              <option value="">— بدون قسم —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_ar}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[12px] font-bold text-ink-3">مصدر الفيديو — ارفع ملفاً أو ضع رابطاً</div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-2 w-full rounded-lg border border-dashed border-line-strong bg-surface px-3 py-3 text-[12.5px] text-ink-3 hover:border-brand hover:text-brand"
            >
              {file ? `📼 ${file.name}` : "اختر ملف فيديو"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="أو رابط خارجي: https://…"
              dir="ltr"
              className={`${input} text-start`}
            />
          </div>

          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="rounded-lg border border-dashed border-line-strong bg-surface px-3 py-2.5 text-[12.5px] text-ink-3 hover:border-brand hover:text-brand"
          >
            {cover ? `🖼 ${cover.name}` : "صورة الغلاف (اختياري)"}
          </button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setCover(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />

          <div className="flex items-end gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12px] font-bold text-ink-3">المدة</span>
              <div className="flex items-center gap-2">
                <input
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
                  placeholder="دقائق"
                  inputMode="numeric"
                  className={input}
                />
                <span className="text-ink-3">:</span>
                <input
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value.replace(/\D/g, ""))}
                  placeholder="ثوانٍ"
                  inputMode="numeric"
                  className={input}
                />
              </div>
            </label>
            <label className="flex items-center gap-2 pb-2 text-[13px] font-semibold">
              <input type="checkbox" checked={isExclusive} onChange={(e) => setIsExclusive(e.target.checked)} />
              خاص
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="rounded-lg bg-brand px-4.5 py-2 text-[13px] font-bold text-paper hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? "جارٍ الرفع…" : "رفع ونشر"}
          </button>
        </div>
      </div>
    </div>
  );
}
