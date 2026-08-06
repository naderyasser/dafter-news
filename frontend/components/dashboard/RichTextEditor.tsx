"use client";

import { useEffect, useRef, useState } from "react";

import TextColorToolbar from "@/components/dashboard/TextColorToolbar";
import { parseInline } from "@/lib/richtext";

/**
 * A body-text field for the block editor that hides the colour/format
 * markup instead of showing it as raw `{c:#hex|…}` syntax while the editor
 * isn't actively typing in it.
 *
 * The textarea is always mounted — TextColorToolbar's apply() needs a real
 * DOM selection into it, and the block header's «✂ تقسيم» / «عنوان فرعي»
 * read its selectionStart the same way — but it's visually replaced by a
 * rendered, colour-true preview whenever the field isn't the one being
 * typed into (`hidden`, not unmounted, so the selection and the ref both
 * survive the swap). Applying a colour/format flips straight back to that
 * preview, so the change reads as instant instead of as a token the editor
 * has to parse in their head; clicking the preview flips back to plain
 * typing.
 *
 * This is NOT a contentEditable surface — the stored value is still the
 * exact plain-text token grammar the API and the public page already read
 * (see lib/richtext.ts). Nothing about what gets saved changes here.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  registerTextarea,
  minHeightClassName = "min-h-[70px]",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Mirrors the textarea node out — ArticleEditorForm keys its own
   *  bodyRefs map off this for the split/heading-conversion actions. */
  registerTextarea?: (el: HTMLTextAreaElement | null) => void;
  minHeightClassName?: string;
}) {
  const [editing, setEditing] = useState(!value.trim());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const segments = parseInline(value);
  const fieldClass = `w-full resize-y rounded-lg border border-line p-2.5 text-[14px] leading-[1.9] outline-none focus:border-brand ${minHeightClassName}`;

  return (
    <>
      <textarea
        ref={(el) => {
          textareaRef.current = el;
          registerTextarea?.(el);
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        // The native attribute, not a Tailwind class — the textarea has to
        // stay mounted (see the file doc comment above) but genuinely
        // invisible and out of the tab order while the preview is showing.
        hidden={!editing}
        className={fieldClass}
      />
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="اضغط للتحرير"
          className={`${fieldClass} block whitespace-pre-wrap text-start`}
        >
          {value.trim() ? (
            segments.map((s, i) =>
              s.color || s.background || s.bold || s.italic || s.underline ? (
                <span
                  key={i}
                  style={{
                    color: s.color,
                    backgroundColor: s.background,
                    fontWeight: s.bold ? 700 : undefined,
                    fontStyle: s.italic ? "italic" : undefined,
                    textDecoration: s.underline ? "underline" : undefined,
                    ...(s.background ? { padding: "0.05em 0.25em", borderRadius: "3px" } : null),
                  }}
                >
                  {s.text}
                </span>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )
          ) : (
            <span className="text-ink-3">{placeholder}</span>
          )}
        </button>
      ) : null}
      {editing ? (
        <TextColorToolbar
          value={value}
          onChange={(next) => {
            onChange(next);
            // The whole point: applying a colour/format reads back
            // instantly as coloured text, never as {c:#hex|…} syntax.
            setEditing(false);
          }}
          textareaRef={textareaRef}
        />
      ) : null}
    </>
  );
}
