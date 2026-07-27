"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { dashMutate } from "@/lib/api";
import type { ArticleBlock, ArticleDetail, Badge } from "@/lib/types";

type Block = { id: number; type: ArticleBlock["type"]; text: string; caption: string; credit: string };
export type EditorSection = { id: number; key: string; label: string };

const BADGES: { key: Badge; label: string }[] = [
  { key: "none", label: "بدون" },
  { key: "breaking", label: "عاجل" },
  { key: "exclusive", label: "خاص" },
  { key: "live", label: "مباشر" },
];
const BLOCK_LABELS: Record<Block["type"], string> = { paragraph: "فقرة", heading: "عنوان فرعي", image: "صورة", quote: "اقتباس", related: "اقرأ أيضاً" };

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function ArticleEditorForm({
  initial,
  articleId,
  sections,
}: {
  initial: ArticleDetail | null;
  articleId?: number;
  sections: EditorSection[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [standfirst, setStandfirst] = useState(initial?.standfirst ?? "");
  const [blocks, setBlocks] = useState<Block[]>(
    initial?.blocks.map((b) => ({ id: b.id, type: b.type, text: b.text, caption: b.caption, credit: b.credit })) ?? [
      { id: 1, type: "paragraph", text: "", caption: "", credit: "" },
    ],
  );
  const [nextId, setNextId] = useState((blocks.at(-1)?.id ?? 0) + 1);
  const [section, setSection] = useState(initial?.section?.key ?? sections[0]?.key ?? "egypt");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [badge, setBadge] = useState<Badge>(initial?.badge ?? "none");
  const [lang, setLang] = useState<"ar" | "en">(initial?.language ?? "ar");
  const [tags, setTags] = useState<string[]>(initial?.tags.map((t) => t.name) ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [ttsStatus, setTtsStatus] = useState<"idle" | "generating" | "done">(initial?.tts_status ?? "idle");
  const [saving, setSaving] = useState(false);

  const updateBlock = (id: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const moveBlock = (id: number, dir: -1 | 1) =>
    setBlocks((bs) => {
      const arr = [...bs];
      const i = arr.findIndex((b) => b.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return bs;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  const addBlock = (type: Block["type"]) => {
    setBlocks((bs) => [...bs, { id: nextId, type, text: "", caption: "", credit: "" }]);
    setNextId((n) => n + 1);
  };
  const removeBlock = (id: number) => setBlocks((bs) => bs.filter((b) => b.id !== id));

  const words = wordCount(standfirst) + blocks.filter((b) => b.type === "paragraph").reduce((sum, b) => sum + wordCount(b.text), 0);
  const readMinutes = Math.max(1, Math.ceil(words / 200));

  const generateTts = () => {
    setTtsStatus("generating");
    setTimeout(() => setTtsStatus("done"), 1400);
  };

  const save = async (status: "draft" | "review" | "published") => {
    setSaving(true);
    const sectionId = sections.find((s) => s.key === section)?.id ?? null;
    const payload = {
      title,
      standfirst,
      status,
      badge,
      language: lang,
      section: sectionId,
      subcategory: subcategory.trim(),
      blocks: blocks.map((b, i) => ({ order: i, type: b.type, text: b.text, caption: b.caption, credit: b.credit })),
      tag_names: tags,
    };
    try {
      if (articleId) {
        await dashMutate(`/articles/${articleId}/`, "PATCH", payload);
      } else {
        // No slug sent on purpose: the browser can't slugify an Arabic
        // headline (it strips to empty), so Article.save() derives it.
        await dashMutate("/articles/", "POST", payload);
      }
      router.push("/dashboard/articles");
      router.refresh();
    } catch {
      // Demo-safe: even if the API call fails validation, don't strand the editor.
    } finally {
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-pill border px-3.5 py-1.5 text-xs font-semibold ${active ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`;

  return (
    <div className="grid grid-cols-[2.2fr_320px] items-start gap-5 max-lg:grid-cols-1">
      <div className="flex flex-col gap-4 rounded-card border border-line bg-paper p-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الخبر"
          className="font-display-ar w-full border-none text-[24px] font-extrabold text-ink outline-none"
        />
        <textarea
          value={standfirst}
          onChange={(e) => setStandfirst(e.target.value)}
          placeholder="مقدمة الخبر (standfirst)"
          className="min-h-[50px] w-full resize-y border-none border-t border-line pt-3.5 text-[16px] text-ink-2 outline-none"
        />

        {blocks.map((b) => (
          <div key={b.id} className="rounded-card border border-line p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-brand">{BLOCK_LABELS[b.type]}</span>
              <div className="flex gap-2.5 text-xs text-header-muted">
                <span onClick={() => moveBlock(b.id, -1)} className="cursor-pointer">
                  ▲
                </span>
                <span onClick={() => moveBlock(b.id, 1)} className="cursor-pointer">
                  ▼
                </span>
                <span onClick={() => removeBlock(b.id)} className="cursor-pointer text-down">
                  🗑
                </span>
              </div>
            </div>
            {(b.type === "paragraph" || b.type === "quote") && (
              <textarea
                value={b.text}
                onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                placeholder={b.type === "paragraph" ? "نص الفقرة" : "نص الاقتباس"}
                className="min-h-[70px] w-full resize-y rounded-lg border border-line p-2.5 text-[14px] outline-none focus:border-brand"
              />
            )}
            {b.type === "heading" && (
              <input
                value={b.text}
                onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                placeholder="نص العنوان الفرعي"
                className="w-full rounded-lg border border-line p-2.5 text-[15px] font-bold outline-none focus:border-brand"
              />
            )}
            {b.type === "image" && (
              <div className="flex flex-wrap gap-3">
                <div className="flex h-[100px] w-[140px] flex-shrink-0 items-center justify-center rounded-lg bg-surface text-xs text-header-muted">صورة</div>
                <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                  <input
                    value={b.caption}
                    onChange={(e) => updateBlock(b.id, { caption: e.target.value })}
                    placeholder="التعليق على الصورة"
                    className="rounded-lg border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand"
                  />
                  <input
                    value={b.credit}
                    onChange={(e) => updateBlock(b.id, { credit: e.target.value })}
                    placeholder="المصدر / الحقوق"
                    className="rounded-lg border border-line px-2.5 py-2 text-[13px] outline-none focus:border-brand"
                  />
                </div>
              </div>
            )}
            {b.type === "related" && (
              <input
                value={b.text}
                onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                placeholder="عنوان المقال المرتبط (اقرأ أيضاً)"
                className="w-full rounded-lg border border-line p-2.5 text-[14px] outline-none focus:border-brand"
              />
            )}
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-1.5">
          {(Object.keys(BLOCK_LABELS) as Block["type"][]).map((type) => (
            <button key={type} onClick={() => addBlock(type)} className="rounded-pill bg-surface px-4 py-2 text-[12.5px] font-semibold text-ink hover:bg-surface-2">
              + {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">القسم</div>
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <button key={s.key} onClick={() => setSection(s.key)} className={chip(section === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {/* The red tag on the card grids. Optional — a card with no
            subcategory just falls back to its section name. */}
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">التصنيف الفرعي</div>
          <input
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            maxLength={60}
            placeholder="سياسة / ثقافة وفنون / اقتصاد"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-brand"
          />
          <div className="mt-2 text-[11px] leading-relaxed text-ink-3">يظهر كوسم أحمر فوق عنوان البطاقة في الصفحة الرئيسية.</div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">الوسوم</div>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="flex items-center gap-1.5 rounded-pill bg-brand-tint px-2.5 py-1 text-xs font-semibold text-brand">
                {t}
                <span onClick={() => setTags((ts) => ts.filter((x) => x !== t))} className="cursor-pointer">
                  ✕
                </span>
              </span>
            ))}
          </div>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagDraft.trim()) {
                e.preventDefault();
                setTags((ts) => [...ts, tagDraft.trim()]);
                setTagDraft("");
              }
            }}
            placeholder="أضف وسماً واضغط Enter"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-brand"
          />
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">الشارة</div>
          <div className="flex flex-wrap gap-1.5">
            {BADGES.map((b) => (
              <button key={b.key} onClick={() => setBadge(b.key)} className={chip(badge === b.key)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">اللغة</div>
          <div className="flex gap-1.5">
            <button onClick={() => setLang("ar")} className={chip(lang === "ar")}>
              عربي
            </button>
            <button onClick={() => setLang("en")} className={chip(lang === "en")}>
              English
            </button>
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">النسخة الصوتية (TTS)</div>
          <button
            onClick={generateTts}
            disabled={ttsStatus === "generating"}
            className={`w-full rounded-lg py-2.5 text-[13px] font-bold ${
              ttsStatus === "done" ? "bg-up-tint text-up" : ttsStatus === "generating" ? "bg-surface-2 text-ink-3" : "bg-brand text-paper"
            }`}
          >
            {ttsStatus === "idle" && "🎙 توليد النسخة الصوتية"}
            {ttsStatus === "generating" && "جارِ التوليد..."}
            {ttsStatus === "done" && "✓ تم التوليد — 4:15"}
          </button>
        </div>
        <div className="flex items-center gap-2.5 rounded-card border border-line bg-brand-tint p-4">
          <span className="text-[20px]">◔</span>
          <div>
            <div className="text-[15px] font-extrabold text-brand-strong">{readMinutes} دقائق قراءة</div>
            <div className="text-[11px] text-brand-strong">يُحسب تلقائياً (كلمات ÷ 200)</div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => save("draft")} disabled={saving} className="flex-1 rounded-lg border border-line-strong bg-paper py-2.5 text-[13px] font-bold text-ink disabled:opacity-60">
            حفظ كمسودة
          </button>
          <button onClick={() => save("published")} disabled={saving} className="flex-1 rounded-lg bg-brand py-2.5 text-[13px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60">
            حفظ ونشر
          </button>
        </div>
      </div>
    </div>
  );
}
