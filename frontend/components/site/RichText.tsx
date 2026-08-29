"use client";

import { useMemo } from "react";

import { mediaUrl } from "@/lib/api";
import { parseInline } from "@/lib/richtext";

/**
 * Renders the editor's inline colour/bold/italic/underline/large markup
 * (lib/richtext.ts) as spans, and an image dropped mid-text as an actual
 * photo. Shared between article bodies (ArticleBlocks) and video
 * descriptions (app/video/[slug]) — both store the same plain-text token
 * grammar in a TextField, so both read it the same way.
 */
export default function Rich({ text }: { text: string }) {
  const segments = useMemo(() => parseInline(text), [text]);
  return (
    <>
      {segments.map((s, i) =>
        s.image !== undefined ? (
          // eslint-disable-next-line @next/next/no-img-element
          <span key={i} style={{ display: "block", margin: "1.25em 0" }}>
            <img src={mediaUrl(s.image) ?? ""} alt="" style={{ display: "block", width: "100%", height: "auto", borderRadius: "8px" }} />
          </span>
        ) : s.color || s.background || s.bold || s.italic || s.underline || s.large || s.subheading ? (
          <span
            key={i}
            style={{
              color: s.color ?? (s.subheading ? "#0E4B7B" : undefined),
              backgroundColor: s.background,
              fontWeight: s.bold || s.large ? 700 : s.subheading ? 800 : undefined,
              fontSize: s.large ? "1.2em" : s.subheading ? "1.15em" : undefined,
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
      )}
    </>
  );
}
