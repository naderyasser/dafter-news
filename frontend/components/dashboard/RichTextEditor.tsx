"use client";

import { useEffect, useRef } from "react";

import TextColorToolbar from "@/components/dashboard/TextColorToolbar";
import { domToTokens, getVisibleSelection, renderTokensInto, setVisibleSelection } from "@/lib/richTextDom";
import { COLOR_OPEN, clearRangeInSegments, mergeColorWrap, parseInline, rawOffsetFromVisible, serializeSegments } from "@/lib/richtext";

/**
 * A body-text field for the block editor: one box that IS the colour/
 * format, not raw `{c:#hex|…}` syntax next to a separate preview of it. An
 * editor selects a word, picks red, and the word in the box they're already
 * looking at turns red — nothing to parse, nothing to toggle between.
 *
 * This is a contentEditable surface, which the rest of the codebase
 * deliberately avoids (see the old textarea-based version's history) —
 * that avoidance was about never handing dangerouslySetInnerHTML an
 * editor-supplied string. Nothing here does that: the DOM this field shows
 * is built exclusively by renderTokensInto, walking our own validated
 * Segment list (lib/richtext.ts's parseInline, whose colour regex is a
 * hex-only allow-list) into real `createElement`/`createTextNode` calls —
 * never innerHTML, and paste is intercepted to insert plain text only. The
 * value that leaves this component (and what the API/public page read) is
 * still the exact same plain-text token grammar as before; only how it's
 * *shown* while editing changed.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  registerField,
  minHeightClassName = "min-h-[70px]",
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Mirrors the editable node out — ArticleEditorForm keys its own field
   *  map off this for the split/heading-conversion actions. */
  registerField?: (el: HTMLDivElement | null) => void;
  minHeightClassName?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  // What WE last emitted via onChange — lets the sync effect below tell "the
  // parent handed our own edit back to us" (DOM is already right, touching
  // it now would only cost the cursor position) apart from a genuinely
  // external change (e.g. «✂ تقسيم» handing this field half its old text).
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (elRef.current) renderTokensInto(elRef.current, value);
  }, [value]);

  // Paint the initial value once, on mount.
  useEffect(() => {
    if (elRef.current) renderTokensInto(elRef.current, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: string) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const onInput = () => {
    const el = elRef.current;
    if (!el) return;
    const next = domToTokens(el);
    // A field emptied by deleting all its text can be left holding a stray
    // <br> in some browsers (added to keep the line height stable) — drop
    // it so the field is genuinely empty rather than "empty but not really".
    if (!next && el.childNodes.length) while (el.firstChild) el.removeChild(el.firstChild);
    commit(next);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !text) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    onInput();
  };

  // A plain "\n" text character, not a browser-invented <div>/<br> — the
  // field's `whitespace-pre-wrap` already renders that as a real line break,
  // and (unlike a <br> element) a Text node's "\n" is one character to
  // Range.toString(), so every offset-by-string-length trick in this file
  // and rawOffsetFromVisible keeps working across it with no special case.
  // This is a soft break *inside* the block — starting an actual new block
  // is still «✂ تقسيم»'s job, deliberately a separate action from Enter.
  const insertLineBreak = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode("\n");
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    onInput();
  };

  /** The current selection as raw offsets into `value`, or null when
   *  there's nothing selected in this field. */
  const rawSelection = () => {
    const el = elRef.current;
    if (!el) return null;
    const vis = getVisibleSelection(el);
    if (!vis || vis.start === vis.end) return null;
    return { start: rawOffsetFromVisible(value, vis.start), end: rawOffsetFromVisible(value, vis.end), vis };
  };

  const applyFormat = (kind: "c" | "h" | "b" | "i" | "u" | "L", color?: string) => {
    const el = elRef.current;
    const sel = rawSelection();
    if (!el || !sel) {
      window.alert(kind === "c" || kind === "h" ? "حدّد النص الذي تريد تلوينه أولاً." : "حدّد النص الذي تريد تنسيقه أولاً.");
      return;
    }
    // An embedded image is atomic — there's no colouring or bolding "part
    // of" one, and a plain wrap around a selection that happens to span one
    // would nest a style token around `{img:…}`, which nothing downstream
    // (parseInline, this field's own DOM renderer) is built to read back.
    if (value.slice(sel.start, sel.end).includes("{img:")) {
      window.alert("لا يمكن تنسيق نص يتضمن صورة.");
      return;
    }
    const merged = mergeColorWrap(value, sel.start, sel.end, kind, color);
    const next = merged
      ? merged.next
      : value.slice(0, sel.start) + COLOR_OPEN(kind, color) + value.slice(sel.start, sel.end) + "}" + value.slice(sel.end);

    renderTokensInto(el, next);
    // Focus before reselecting, not after: focusing an element that's
    // already the selection's container can itself collapse the selection
    // in some engines, which would silently drop the "no need to re-select
    // before the next format" behaviour this is for.
    el.focus();
    // Same visible span, now styled — the reader sees the colour land
    // exactly where their selection was, and can immediately follow it
    // with a second format (e.g. bold after colour) without re-selecting.
    setVisibleSelection(el, sel.vis.start, sel.vis.end);
    commit(next);
  };

  const clearFormat = () => {
    const el = elRef.current;
    if (!el) return;
    // Segment-based, not a raw-offset slice: rawOffsetFromVisible lands
    // *inside* an existing token's payload on purpose (see applyFormat, and
    // rawOffsetFromVisible's own doc comment) — exactly wrong for clearing,
    // since slicing there and splicing the same substring back in
    // reproduces the original token, wrapper included. Working from the
    // parsed segments has no wrapper to accidentally preserve.
    const vis = getVisibleSelection(el);
    const hasSelection = vis && vis.start !== vis.end;
    const segments = parseInline(value);
    // Same rule as clearRangeInSegments: an image segment is never stripped
    // down to its bare PLACEHOLDER text, which would silently drop the
    // image it refers to.
    const cleared = hasSelection
      ? clearRangeInSegments(segments, vis.start, vis.end)
      : segments.map((s) => (s.image !== undefined ? s : { text: s.text }));
    const next = serializeSegments(cleared);

    renderTokensInto(el, next);
    el.focus();
    if (hasSelection) setVisibleSelection(el, vis.start, vis.end);
    commit(next);
  };

  return (
    <>
      <div
        ref={(el) => {
          elRef.current = el;
          registerField?.(el);
        }}
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={(e) => {
          // Keeps the field's DOM exactly the shape renderTokensInto/
          // domToTokens agree on — plain text and single-level <span>s.
          // The browser's own Enter behaviour would insert a <div>/<br> that
          // walk() doesn't understand, so it's replaced with a plain "\n"
          // character instead (see insertLineBreak). Ctrl/Cmd+B/I/U would
          // apply the browser's own bold/italic/underline command outside
          // applyFormat, which is the only place that keeps this field's
          // markup and its visible text in sync.
          if (e.key === "Enter") {
            e.preventDefault();
            insertLineBreak();
          }
          if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) e.preventDefault();
        }}
        className={`w-full resize-y whitespace-pre-wrap rounded-lg border border-line p-2.5 text-[15px] leading-[1.9] outline-none empty:before:text-ink-3 empty:before:content-[attr(data-placeholder)] focus:border-brand ${minHeightClassName}`}
      />
      <TextColorToolbar value={value} onApply={applyFormat} onClear={clearFormat} />
    </>
  );
}
