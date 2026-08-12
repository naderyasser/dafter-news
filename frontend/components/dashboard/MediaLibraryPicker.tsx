"use client";

import { useEffect, useRef, useState } from "react";

import { getMediaAssets, mediaUrl } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";

/**
 * Search-and-pick panel over the internal media library.
 *
 * The client's request: an editor writing about a public figure types the
 * name («الرئيس», «محمد صلاح») and gets the site's own previously-uploaded
 * photos back — no hunting outside the site, no re-uploading, and the
 * licensing stays whatever the library already recorded for that file.
 *
 * Search hits /api/media/?search= (title, alt, credit, source and the linked
 * article's title), debounced so typing doesn't fire a request per keystroke.
 */
export default function MediaLibraryPicker({
  onPick,
  onClose,
}: {
  onPick: (asset: MediaAsset) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const id = window.setTimeout(async () => {
      const res = await getMediaAssets(query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "");
      if (cancelled) return;
      setAssets(res.results);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="مكتبة الصور"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(6,38,57,.55)] p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[720px] max-w-full flex-col overflow-hidden rounded-card border border-line bg-paper shadow-2"
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="text-[15px] font-extrabold text-ink">مكتبة الصور</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الصورة أو الشخصية…"
            aria-label="ابحث في مكتبة الصور"
            className="min-w-0 flex-1 rounded-pill border border-line bg-surface px-3.5 py-2 text-[14px] outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line text-[15px] text-ink-3 hover:border-brand hover:text-brand"
          >
            ✕
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-10 text-center text-[14px] text-ink-3">جارِ البحث…</div>
          ) : assets.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-ink-3">
              لا توجد نتائج — جرّب اسماً آخر، أو ارفع الصورة من صفحة «الوسائط» أولاً.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onPick(a)}
                  className="group overflow-hidden rounded-card border border-line bg-paper text-start transition-colors duration-fast hover:border-accent"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(a.image) ?? ""} alt={a.alt || a.title} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-2">
                    <div className="truncate text-[13px] font-bold text-ink group-hover:text-accent">{a.title || a.alt || "بدون اسم"}</div>
                    <div className="truncate text-[12px] text-ink-3">{a.credit || a.license_label}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
