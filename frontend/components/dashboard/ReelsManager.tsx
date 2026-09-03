"use client";

import { useState } from "react";

import { dashMutate, dashUpload, mediaUrl } from "@/lib/api";
import type { Reel } from "@/lib/types";

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-brand";

/**
 * «حصل إيه؟» — the Facebook shorts shelf on the home page.
 *
 * ONE field on the form: the reel's Facebook link. Both the title and the
 * poster are read off that link's own page (see the backend's video/og.py),
 * so pasting the URL is the whole job.
 *
 * No upload, no duration, no player: the reel does not live on this site. The
 * card is a poster that sends the reader to the paper's Facebook page, and any
 * field implying otherwise would be a promise the shelf does not keep.
 */
export default function ReelsManager({ reels: initial }: { reels: Reel[] }) {
  const [reels, setReels] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const remove = async (reel: Reel) => {
    if (!confirm(`حذف «${reel.title}» من «حصل إيه؟»؟`)) return;
    const before = reels;
    setReels((rs) => rs.filter((r) => r.id !== reel.id));
    try {
      await dashMutate(`/reels/${reel.id}/`, "DELETE");
    } catch {
      setReels(before);
      setError("تعذّر حذف الريل.");
    }
  };

  /**
   * Move one reel a single place along the rail.
   *
   * Two rows swap their `order`, rather than the list being renumbered from
   * scratch: a full renumber writes a row per reel on every nudge, and any one
   * of those requests failing leaves the rail in an order nobody chose. A swap
   * is one PATCH per side and rolls back cleanly.
   */
  const move = async (index: number, delta: -1 | 1) => {
    const next = index + delta;
    if (next < 0 || next >= reels.length) return;
    const a = reels[index];
    const b = reels[next];
    const before = reels;
    // The two may share an `order` (everything defaults to 0), in which case
    // swapping the stored values changes nothing. Fall back to their positions
    // so the first nudge on an untouched rail still moves something.
    const [orderA, orderB] = a.order === b.order ? [next, index] : [b.order, a.order];
    const reordered = [...reels];
    reordered[index] = { ...b, order: orderB };
    reordered[next] = { ...a, order: orderA };
    setReels(reordered);
    try {
      await Promise.all([
        dashMutate(`/reels/${a.id}/`, "PATCH", { order: orderA }),
        dashMutate(`/reels/${b.id}/`, "PATCH", { order: orderB }),
      ]);
    } catch {
      setReels(before);
      setError("تعذّر إعادة الترتيب.");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[14px] text-ink-3">{reels.length} ريل</span>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg bg-brand px-4.5 py-2.5 text-[14px] font-bold text-paper hover:bg-brand-strong"
        >
          ＋ إضافة ريل
        </button>
      </div>

      <p className="m-0 rounded-card border border-line bg-surface px-4 py-3 text-[13.5px] leading-[1.7] text-ink-3">
        بطاقات «حصل إيه؟» تظهر في الصفحة الرئيسية ولا تُشغَّل عليها — الضغط عليها يفتح الريل على صفحة الجريدة في
        فيسبوك مباشرةً. الترتيب هنا هو ترتيب الشريط نفسه، من البداية.
      </p>

      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[14px] font-semibold text-down">
          {error}
        </div>
      )}

      {/*
        `flex flex-wrap` with a FIXED tile width, not `grid-cols-[repeat(auto-
        fit,minmax(…,1fr))]` — that grid recipe was the actual cause of the
        reported distortion. `auto-fit` collapses to exactly as many columns
        as there are cards, and `1fr` then hands each one every pixel of
        leftover row width — with a single reel (today's actual state) that is
        the whole content area's width, and since the poster's box is
        `aspect-[9/16]` rather than a fixed size, growing the width grows the
        HEIGHT to match, so a lone card rendered as an enormous vertical
        column. object-cover then filled that column by cropping deep into
        the source photo, which reads as "stretched" even though no pixel was
        actually stretched. A fixed `w-48` tile is immune to how many reels
        exist: the row wraps instead of the cards inflating.
      */}
      <div className="flex flex-wrap gap-4">
        {reels.map((reel, i) => (
          <div key={reel.id} className="w-48 overflow-hidden rounded-card border border-line bg-paper">
            <a
              href={reel.facebook_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-[9/16] overflow-hidden bg-surface-2 no-underline"
            >
              {reel.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(reel.thumbnail)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                // A tall grey rectangle with nothing in it reads as a screen
                // that failed to render rather than as a card awaiting its
                // picture — which is exactly how this was reported. Say which
                // one it is, and say what to do about it.
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center">
                  <span className="text-[22px] leading-none text-ink-3" aria-hidden>
                    ▶
                  </span>
                  <span className="text-[12.5px] font-bold leading-[1.6] text-ink-3">
                    تعذّر جلب الصورة من فيسبوك
                  </span>
                </span>
              )}
            </a>
            <div className="p-3">
              <div className="mb-2 line-clamp-2 text-[14px] font-bold leading-[1.5] text-ink">{reel.title}</div>
              <div className="flex items-center justify-between text-xs text-ink-3">
                <div className="flex gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="تقديم"
                    title="تقديم"
                    className="rounded border border-line px-2 py-0.5 font-bold text-ink disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === reels.length - 1}
                    aria-label="تأخير"
                    title="تأخير"
                    className="rounded border border-line px-2 py-0.5 font-bold text-ink disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
                <button onClick={() => remove(reel)} className="font-bold text-down">
                  مسح
                </button>
              </div>
            </div>
          </div>
        ))}
        {reels.length === 0 && (
          <div className="w-full p-8 text-center text-ui text-ink-3">لا توجد ريلز بعد</div>
        )}
      </div>

      {adding && (
        <AddDialog
          onCancel={() => setAdding(false)}
          onCreated={(reel) => {
            setReels((rs) => [...rs, reel]);
            setAdding(false);
          }}
          onError={setError}
        />
      )}
    </>
  );
}

function AddDialog({
  onCancel,
  onCreated,
  onError,
}: {
  onCancel: () => void;
  onCreated: (reel: Reel) => void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // The link is the whole point of the card, so it is required here — a reel
  // saved without one is a poster that goes nowhere. The API refuses it too.
  const canSave = url.trim().length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("facebook_url", url.trim());
      // No title, no poster field: the server reads the reel's own Facebook
      // page and takes both the caption and the frame it already advertises
      // (see the backend's video/og.py). The row comes back with `title` and
      // `thumbnail` already filled in, so the card below shows the real
      // picture and text without a second step.
      onCreated(await dashUpload<Reel>("/reels/", "POST", form));
    } catch {
      onError("تعذّر حفظ الريل. تأكد من الرابط وحاول مرة أخرى.");
      onCancel();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,11,13,.55)] p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="إضافة ريل"
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-full w-full max-w-[460px] overflow-y-auto rounded-card bg-paper p-5 shadow-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">إضافة ريل</span>
          <button onClick={onCancel} aria-label="إغلاق" className="text-[18px] leading-none text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold text-ink-3">رابط الريل على فيسبوك</span>
            {/* dir="ltr" so a URL doesn't reorder itself inside an RTL form. */}
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.facebook.com/reel/…"
              dir="ltr"
              autoFocus
              className={`${input} text-start`}
            />
          </label>

          <p className="m-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] leading-[1.7] text-ink-3">
            العنوان والصورة المصغّرة يُجلبان تلقائياً من الريل نفسه بعد الحفظ — لا حاجة لكتابتهما. إن تعذّر
            جلبهما (ريل خاص أو محذوف) تظهر البطاقة بعنوان وصورة بديلين، ويمكن حذفها والمحاولة مرة أخرى.
          </p>
        </div>

        {/*
          Tokens, not the literal gray-300/red-700 Tailwind palette classes:
          this admin theme is built on named tokens (brand/ink/line/paper —
          tailwind.config.ts), not the default Tailwind gray and red scales,
          precisely so a button here always reads as the same red as the
          logo and every other primary action in the dashboard rather than a
          shade some other request happened to specify. The requested shape
          — a light bordered secondary button beside a solid red primary one,
          right-aligned, with a visible focus ring on the primary — is what
          changed; the specific hex values did not.
        */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line bg-paper px-4 py-2 text-[14px] font-semibold text-ink transition-colors hover:bg-surface"
          >
            إلغاء
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="rounded-lg bg-brand px-4 py-2 text-[14px] font-bold text-paper transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {busy ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
