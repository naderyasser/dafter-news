"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import TextColorToolbar from "@/components/dashboard/TextColorToolbar";
import { domToTokens, getVisibleSelection, renderTokensInto, setVisibleSelection } from "@/lib/richTextDom";
import { COLOR_OPEN, clearRangeInSegments, mergeColorWrap, parseInline, rawOffsetFromVisible, serializeSegments } from "@/lib/richtext";

/** Imperative handle for a shared, lifted-out toolbar (ArticleEditorForm's
 *  single static one) to drive whichever field currently has focus, without
 *  every field rendering its own copy of the same buttons. */
export type RichTextEditorHandle = {
  applyFormat: (kind: "c" | "h" | "b" | "i" | "u" | "L" | "H", color?: string) => void;
  clearFormat: () => void;
  focus: () => void;
};

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
const RichTextEditor = forwardRef<RichTextEditorHandle, {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  /** Mirrors the editable node out — ArticleEditorForm keys its own field
   *  map off this for the split/heading-conversion actions. */
  registerField?: (el: HTMLDivElement | null) => void;
  /** ArticleEditorForm tracks "which paragraph is the reader in" off this,
   *  so its one static toolbar knows which field the `ref` handle above
   *  should act on. */
  onFocus?: () => void;
  /**
   * false when a shared toolbar elsewhere drives this field via the `ref`
   * handle instead — one static toolbar for the whole article, not one
   * copy of the same buttons under every paragraph. Defaults to true so
   * every other caller (VideosManager's single description field) is
   * unaffected.
   */
  showToolbar?: boolean;
  /**
   * false to drop this field's own border/background — used when several
   * of these sit stacked inside one shared bordered container (the article
   * body), so the whole thing reads as one continuous box instead of a
   * stack of separately-framed ones.
   */
  bordered?: boolean;
  /**
   * A paste whose plain text spans more than one *paragraph* — separated by
   * a blank line, not just a line break — hands off here instead of landing
   * in this one field. `before`/`after` are the raw (token-grammar) text on
   * either side of the cursor at paste time, and `lines` is the pasted text
   * split on blank lines (a paragraph may still carry single line breaks
   * inside it — see onPaste below). ArticleEditorForm turns that into one
   * block per paragraph, with the first/last merged into `before`/`after`,
   * matching «✂ تقسيم»'s own block-splitting shape rather than inventing a
   * second one.
   *
   * Without this, pasting a multi-paragraph article (the normal write-in-
   * Word-then-paste workflow) landed as one field with the paragraph breaks
   * as bare "\n" characters inside a single block — visible while editing
   * (this field is `whitespace-pre-wrap`) but not a separate, independently
   * movable/stylable paragraph the way every other block on the page is.
   * Omitted entirely falls back to the old single-field-with-embedded-
   * newlines paste.
   */
  onSplitPaste?: (before: string, lines: string[], after: string) => void;
  minHeightClassName?: string;
}>(function RichTextEditor(
  {
    value,
    onChange,
    placeholder,
    registerField,
    onFocus,
    showToolbar = true,
    bordered = true,
    onSplitPaste,
    minHeightClassName = "min-h-[70px]",
  },
  ref,
) {
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

    const normalized = text.replace(/\r\n?/g, "\n");

    // A blank line — two or more consecutive breaks — is the one signal
    // every source (Word, Docs, a plain .txt wire copy) uses for "this is a
    // new paragraph". A *single* line break inside otherwise-continuous text
    // is a soft wrap, not a paragraph boundary — WhatsApp in particular
    // breaks almost every sentence onto its own line without ever leaving a
    // blank one between them, and treating that the same as a real
    // paragraph gap turned every WhatsApp-composed article into a wall of
    // one-sentence blocks the moment it was pasted in. A lone break stays
    // inside the block, as the same soft "\n" character Enter inserts here
    // (see insertLineBreak) — only a real paragraph gap starts a new block.
    const paragraphs = normalized
      .split(/\n[ \t]*\n+/)
      .map((p) => p.replace(/^[ \t\n]+|[ \t\n]+$/g, ""))
      .filter(Boolean);

    if (paragraphs.length > 1 && onSplitPaste) {
      const el = elRef.current;
      const vis = el ? getVisibleSelection(el) : null;
      const visStart = vis ? vis.start : 0;
      const visEnd = vis ? vis.end : visStart;
      onSplitPaste(value.slice(0, rawOffsetFromVisible(value, visStart)), paragraphs, value.slice(rawOffsetFromVisible(value, visEnd)));
      return;
    }

    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(normalized));
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

  const applyFormat = (kind: "c" | "h" | "b" | "i" | "u" | "L" | "H", color?: string) => {
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

  // Lets ArticleEditorForm's one shared, static toolbar act on whichever of
  // these fields last had focus, instead of every field carrying its own
  // copy of the same buttons.
  useImperativeHandle(ref, () => ({ applyFormat, clearFormat, focus: () => elRef.current?.focus() }));

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
        onFocus={onFocus}
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
        className={`w-full resize-y whitespace-pre-wrap p-2.5 text-[15px] leading-[1.9] outline-none empty:before:text-ink-3 empty:before:content-[attr(data-placeholder)] ${
          bordered ? "rounded-lg border border-line focus:border-brand" : "rounded-md focus:bg-surface"
        } ${minHeightClassName}`}
      />
      {showToolbar ? <TextColorToolbar value={value} onApply={applyFormat} onClear={clearFormat} /> : null}
    </>
  );
});

export default RichTextEditor;
