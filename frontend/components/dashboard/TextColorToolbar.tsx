"use client";

import { useState } from "react";

import { parseInline } from "@/lib/richtext";

/**
 * Colour, highlight and bold/italic/underline controls for a body block —
 * «فين لو عايز الون خبر او كلام» plus the basic B/I/U formatting an editor
 * expects from any text tool.
 *
 * Purely presentational: it has no idea what element it's formatting or how
 * a selection is read from it. RichTextEditor owns that (it needs to, since
 * it's editing a contentEditable box, not a plain input) and hands this
 * component two callbacks — `onApply`/`onClear` — plus the current `value`,
 * used only to decide whether there's anything to clear. There is
 * deliberately no separate "preview" here any more: RichTextEditor's own
 * box already shows the coloured/formatted result live, so a second render
 * of the same thing next to it would just be a stale duplicate.
 */
const SWATCHES = [
  { color: "#0E4B7B", label: "أزرق الهوية" },
  { color: "#B01F2E", label: "أحمر الهوية" },
  { color: "#12793F", label: "أخضر" },
  { color: "#8A6410", label: "ذهبي" },
  { color: "#7A3E9D", label: "بنفسجي" },
  { color: "#171A1F", label: "أسود" },
];

const HIGHLIGHTS = [
  { color: "#FFF3B0", label: "أصفر" },
  { color: "#EAF1F8", label: "أزرق فاتح" },
  { color: "#FBEEEF", label: "أحمر فاتح" },
  { color: "#E7F4ED", label: "أخضر فاتح" },
];

export default function TextColorToolbar({
  value,
  onApply,
  onClear,
}: {
  value: string;
  onApply: (kind: "c" | "h" | "b" | "i" | "u" | "L", color?: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasFormatting = parseInline(value).some((s) => s.color || s.background || s.bold || s.italic || s.underline || s.large);

  // Every control here reads the editor's live text selection at click time
  // (see RichTextEditor's applyFormat) — but a bare mousedown on any element
  // is itself a browser selection gesture, and by default collapses whatever
  // was selected to the click point before the click (and onApply) ever
  // fires. preventDefault on mousedown stops that collapse without stopping
  // the click, so the selection an editor just made is still there to act on.

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Bold/italic/underline act on the selection immediately — unlike
            colour, there's no palette to choose from, so these don't need
            the panel behind a toggle. */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApply("b")}
          title="غامق (Bold)"
          aria-label="نص غامق"
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface text-[13px] font-extrabold text-ink hover:bg-surface-2"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApply("i")}
          title="مائل (Italic)"
          aria-label="نص مائل"
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface text-[13px] font-bold italic text-ink hover:bg-surface-2"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApply("u")}
          title="تحته خط (Underline)"
          aria-label="نص تحته خط"
          className="flex h-7 w-7 items-center justify-center rounded border border-line bg-surface text-[13px] font-bold text-ink underline hover:bg-surface-2"
        >
          U
        </button>
        {/* «فقرة» — the client's own word for a line set bigger and bolder
            than the body around it, e.g. a lead sentence. Same mechanics as
            B/I/U: acts on the selection, stays inline in the same box. */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onApply("L")}
          title="فقرة (نص أكبر وأغمق من باقي المحتوى)"
          aria-label="فقرة"
          className="flex h-7 items-center justify-center rounded border border-line bg-surface px-2 text-[13px] font-extrabold text-ink hover:bg-surface-2"
        >
          فقرة
        </button>
        <span className="h-5 w-px bg-line" aria-hidden />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-surface-2"
        >
          <span aria-hidden>🎨</span> تلوين النص
        </button>
        {hasFormatting ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClear}
            className="rounded-pill border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-3 hover:text-down"
          >
            إزالة التلوين
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="mt-2 flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
          <div>
            <div className="mb-1.5 text-[11.5px] font-bold text-ink-2">لون النص</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SWATCHES.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  title={s.label}
                  aria-label={`لون النص: ${s.label}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onApply("c", s.color)}
                  className="h-7 w-7 rounded-full border border-line-strong"
                  style={{ backgroundColor: s.color }}
                />
              ))}
              <input
                type="color"
                aria-label="لون مخصّص للنص"
                defaultValue="#0E4B7B"
                onChange={(e) => onApply("c", e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-line-strong bg-paper p-0.5"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] font-bold text-ink-2">لون الخلفية (تظليل)</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {HIGHLIGHTS.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  title={s.label}
                  aria-label={`تظليل: ${s.label}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onApply("h", s.color)}
                  className="h-7 w-7 rounded-full border border-line-strong"
                  style={{ backgroundColor: s.color }}
                />
              ))}
              <input
                type="color"
                aria-label="لون تظليل مخصّص"
                defaultValue="#FFF3B0"
                onChange={(e) => onApply("h", e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-line-strong bg-paper p-0.5"
              />
            </div>
          </div>

          <p className="m-0 text-[11.5px] leading-relaxed text-ink-3">
            حدّد كلمة أو جملة داخل النص ثم اختر اللون — يتلوّن فوراً في الصندوق نفسه.
          </p>
        </div>
      ) : null}
    </div>
  );
}
