"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { dashMutate, dashUpload, mediaUrl } from "@/lib/api";
import { articleHref } from "@/lib/routes";
import type { MediaAsset, MediaLicense } from "@/lib/types";

/** Mirrors MediaAsset.License on the server. */
const LICENSES: { key: MediaLicense; label: string }[] = [
  { key: "owned", label: "ملكية الدفتر" },
  { key: "agency", label: "وكالة" },
  { key: "cc", label: "المشاع الإبداعي" },
  { key: "permission", label: "بإذن الناشر" },
  { key: "unknown", label: "غير محدد" },
];

export type MediaArticleOption = { id: number; title: string; slug: string };

const input =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-brand";

export default function MediaManager({
  assets: initial,
  articles,
}: {
  assets: MediaAsset[];
  articles: MediaArticleOption[];
}) {
  const [assets, setAssets] = useState(initial);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filtering client-side: the library is a few hundred rows at most and the
  // whole page is already loaded, so a round trip per keystroke would be
  // slower than the filter. The API's ?search= stays available for when it
  // outgrows that.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) =>
      [a.title, a.alt, a.credit, a.source, a.article_title ?? ""].some((f) => f.toLowerCase().includes(q)),
    );
  }, [assets, query]);

  const upload = async (files: FileList) => {
    setError("");
    setUploading(true);
    const before = assets;
    const total = files.length;
    // Declared outside the try block so the catch clause below can still see
    // how many files made it through before the failure.
    const created: MediaAsset[] = [];
    try {
      // Sequential rather than parallel: a bulk drop of 30 photos would
      // otherwise open 30 concurrent multipart uploads and stall them all.
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("image", file);
        form.append("title", file.name.replace(/\.[^.]+$/, ""));
        created.push(await dashUpload<MediaAsset>("/media/", "POST", form));
        // Commit after every file, not just at the end of the loop: each of
        // these has already been persisted server-side, so if a later file in
        // the same drop is rejected, the ones that succeeded must still show
        // up instead of being silently dropped from the grid.
        setAssets([...created, ...before]);
      }
    } catch {
      setError(
        created.length
          ? `رُفعت ${created.length} من ${total} صورة، وتعذّر رفع الباقي. تحقق من نوع الملفات المتبقية قبل إعادة رفعها فقط.`
          : "تعذّر رفع الصور. تأكد من نوع الملف وحاول مرة أخرى.",
      );
    } finally {
      setUploading(false);
    }
  };

  const saveMeta = async (patch: MediaAsset) => {
    setError("");
    // Optimistic: the grid updates now, and reverts to the server's copy only
    // if the write comes back failed.
    const before = assets;
    setAssets((prev) => prev.map((a) => (a.id === patch.id ? patch : a)));
    setEditing(null);
    try {
      const saved = await dashMutate<MediaAsset>(`/media/${patch.id}/`, "PATCH", {
        title: patch.title,
        alt: patch.alt,
        credit: patch.credit,
        license: patch.license,
        source: patch.source,
        article: patch.article,
      });
      setAssets((prev) => prev.map((a) => (a.id === saved.id ? saved : a)));
    } catch {
      setAssets(before);
      setError("تعذّر حفظ بيانات الصورة.");
    }
  };

  const remove = async (asset: MediaAsset) => {
    if (!confirm(`حذف «${asset.title || asset.alt || "الصورة"}» نهائياً؟`)) return;
    const before = assets;
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    try {
      await dashMutate(`/media/${asset.id}/`, "DELETE");
    } catch {
      setAssets(before);
      setError("تعذّر حذف الصورة.");
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالعنوان أو المصدر أو الخبر المرتبط..."
          className="max-w-[360px] flex-1 rounded-lg border border-line bg-paper px-3.5 py-2.5 text-[14px] outline-none focus:border-brand"
        />
        <span className="text-[13.5px] text-ink-3">
          {query ? `${visible.length} من ${assets.length}` : `${assets.length} صورة`}
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="ms-auto rounded-lg bg-brand px-4.5 py-2.5 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60"
        >
          {uploading ? "جارٍ الرفع…" : "⬆ رفع صور متعددة"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[14px] font-semibold text-down">
          {error}
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {visible.map((m) => {
          // The whole thumbnail is the article link when there is one, so the
          // editor doesn't have to hunt for a small chip.
          const frameClass = "relative block aspect-[4/3] bg-surface-2 no-underline";
          const thumb = (
            <>
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(m.image)} alt={m.alt} className="h-full w-full object-cover" />
              ) : null}
              {m.article_slug ? (
                <span className="absolute bottom-0 start-0 bg-brand px-2 py-1 text-[11.5px] font-bold text-paper">
                  مرتبطة بخبر ↗
                </span>
              ) : null}
            </>
          );
          return (
            <div key={m.id} className="group overflow-hidden rounded-card border border-line bg-paper">
              {m.article_slug ? (
                <Link
                  href={articleHref({ kind: m.article_kind ?? "news", slug: m.article_slug })}
                  title={`فتح: ${m.article_title}`}
                  className={frameClass}
                >
                  {thumb}
                </Link>
              ) : (
                <div className={frameClass}>{thumb}</div>
              )}
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <span className="truncate text-xs font-semibold text-ink">{m.title || m.alt || "بدون عنوان"}</span>
                <span className="truncate text-[12px] text-ink-3">
                  {m.license_label}
                  {m.credit ? ` · ${m.credit}` : ""}
                </span>
                <div className="mt-1 flex gap-3 text-[12.5px]">
                  <button onClick={() => setEditing(m)} className="font-bold text-brand hover:underline">
                    تعديل
                  </button>
                  <button onClick={() => remove(m)} className="font-bold text-down hover:underline">
                    مسح
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <div className="col-span-full p-8 text-center text-ui text-ink-3">
            {assets.length ? "لا نتائج مطابقة للبحث" : "لا توجد وسائط بعد"}
          </div>
        )}
      </div>

      {editing && (
        <MetadataDialog
          asset={editing}
          articles={articles}
          onCancel={() => setEditing(null)}
          onSave={saveMeta}
        />
      )}
    </>
  );
}

function MetadataDialog({
  asset,
  articles,
  onCancel,
  onSave,
}: {
  asset: MediaAsset;
  articles: MediaArticleOption[];
  onCancel: () => void;
  onSave: (a: MediaAsset) => void;
}) {
  const [draft, setDraft] = useState(asset);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,11,13,.55)] p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="تعديل بيانات الصورة"
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-full w-full max-w-[520px] overflow-y-auto rounded-card bg-paper p-5 shadow-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">بيانات الصورة</span>
          <button onClick={onCancel} aria-label="إغلاق" className="text-[18px] leading-none text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        {draft.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(draft.image)} alt={draft.alt} className="mb-4 max-h-[200px] w-full rounded-lg object-contain bg-surface-2" />
        ) : null}

        <div className="flex flex-col gap-3">
          <Field label="العنوان">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={input} />
          </Field>
          {/* Kept separate from the title: this is what a screen reader says. */}
          <Field label="النص البديل">
            <input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} className={input} />
          </Field>
          <Field label="نوع الترخيص">
            <select
              value={draft.license}
              onChange={(e) => setDraft({ ...draft, license: e.target.value as MediaLicense })}
              className={input}
            >
              {LICENSES.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المصدر">
            <input
              value={draft.source}
              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
              placeholder="وكالة أنباء / رابط / مصوّر"
              className={input}
            />
          </Field>
          <Field label="الحقوق">
            <input value={draft.credit} onChange={(e) => setDraft({ ...draft, credit: e.target.value })} className={input} />
          </Field>
          <Field label="الخبر المرتبط">
            <select
              value={draft.article ?? ""}
              onChange={(e) => setDraft({ ...draft, article: e.target.value ? Number(e.target.value) : null })}
              className={input}
            >
              <option value="">— بدون ربط —</option>
              {articles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-[14px] font-semibold text-ink hover:bg-surface">
            إلغاء
          </button>
          <button onClick={() => onSave(draft)} className="rounded-lg bg-brand px-4.5 py-2 text-[14px] font-bold text-paper hover:bg-brand-strong">
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-ink-3">{label}</span>
      {children}
    </label>
  );
}
