"use client";

import { useRef, useState } from "react";

import { COLOR_OPEN, parseInline } from "@/lib/richtext";

/**
 * Text-colour and highlight controls for a body block — «فين لو عايز الون خبر
 * او كلام».
 *
 * It drives a plain <textarea> rather than a contentEditable surface. That is
 * a deliberate trade: a contentEditable produces HTML, and article bodies are
 * plain-text fields inside structured blocks, so rendering that HTML back
 * would mean dangerouslySetInnerHTML on editor-supplied markup. Wrapping the
 * selection in a token instead keeps the stored value plain text end to end
 * (see lib/richtext.ts), and the preview below shows exactly what the reader
 * will get.
 *
 * The swatches are the site's own palette — an editor colouring a word should
 * be reaching for a brand colour, not an arbitrary one — with a free picker
 * after them for the cases the palette doesn't cover.
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
  onChange,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const [open, setOpen] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);

  /**
   * Wrap whatever is selected. With an empty selection there is nothing to
   * colour, so the toolbar says so instead of inserting an empty token the
   * editor would then have to type inside — the failure mode of every
   * "apply to cursor" implementation.
   */
  const apply = (kind: "c" | "h", color: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    if (start === end) {
      window.alert("حدّد النص الذي تريد تلوينه أولاً.");
      return;
    }
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + COLOR_OPEN(kind, color) + selected + "}" + value.slice(end);
    onChange(next);
    // Keep the same words selected after the rewrite so a colour can be
    // followed by a highlight without re-selecting.
    const offset = COLOR_OPEN(kind, color).length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + offset, end + offset);
    });
  };

  /** Strip every colour token overlapping the selection (or all of them). */
  const clear = () => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end } = el;
    const target = start === end ? value : value.slice(start, end);
    const stripped = target.replace(/\{[ch]:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\|([^{}]*)\}/g, "$1");
    onChange(start === end ? stripped : value.slice(0, start) + stripped + value.slice(end));
  };

  const segments = parseInline(value);
  const hasColour = segments.some((s) => s.color || s.background);

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-surface-2"
        >
          <span aria-hidden>🎨</span> تلوين النص
        </button>
        {hasColour ? (
          <button
            type="button"
            onClick={clear}
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
                  onClick={() => apply("c", s.color)}
                  className="h-7 w-7 rounded-full border border-line-strong"
                  style={{ backgroundColor: s.color }}
                />
              ))}
              <input
                ref={customRef}
                type="color"
                aria-label="لون مخصّص للنص"
                defaultValue="#0E4B7B"
                onChange={(e) => apply("c", e.target.value)}
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
                  onClick={() => apply("h", s.color)}
                  className="h-7 w-7 rounded-full border border-line-strong"
                  style={{ backgroundColor: s.color }}
                />
              ))}
              <input
                type="color"
                aria-label="لون تظليل مخصّص"
                defaultValue="#FFF3B0"
                onChange={(e) => apply("h", e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border border-line-strong bg-paper p-0.5"
              />
            </div>
          </div>

          <p className="m-0 text-[11.5px] leading-relaxed text-ink-3">
            حدّد كلمة أو جملة داخل النص ثم اختر اللون. المعاينة بالأسفل تُظهر الشكل النهائي كما سيراه القارئ.
          </p>
        </div>
      ) : null}

      {hasColour ? (
        <div className="mt-2 rounded-lg border border-dashed border-line bg-paper p-2.5">
          <div className="mb-1 text-[11px] font-bold text-ink-3">معاينة</div>
          <p className="m-0 text-[14px] leading-[1.9] text-ink">
            {segments.map((s, i) => (
              <span
                key={i}
                style={{
                  color: s.color,
                  backgroundColor: s.background,
                  ...(s.background ? { padding: "0.05em 0.25em", borderRadius: "3px" } : null),
                }}
              >
                {s.text}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
