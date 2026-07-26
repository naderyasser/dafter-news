"use client";

import { useState } from "react";

import { apiMutate } from "@/lib/api";
import { toEasternNumerals } from "@/lib/format";
import type { Section, Tag } from "@/lib/types";

export default function TaxonomyManager({ sections: initialSections, tags: initialTags }: { sections: Section[]; tags: Tag[] }) {
  const [sections, setSections] = useState(initialSections);
  const [tags, setTags] = useState(initialTags);
  const [tagDraft, setTagDraft] = useState("");

  const move = async (id: number, dir: -1 | 1) => {
    const i = sections.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const arr = [...sections];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setSections(arr);
    try {
      await Promise.all([apiMutate(`/sections/${arr[i].key}/`, "PATCH", { order: i }), apiMutate(`/sections/${arr[j].key}/`, "PATCH", { order: j })]);
    } catch {}
  };

  const removeSection = async (id: number) => {
    const s = sections.find((x) => x.id === id);
    setSections((ss) => ss.filter((x) => x.id !== id));
    if (s) {
      try {
        await apiMutate(`/sections/${s.key}/`, "DELETE");
      } catch {}
    }
  };

  const addTag = async () => {
    const name = tagDraft.trim();
    if (!name) return;
    setTagDraft("");
    try {
      const created = await apiMutate<Tag>("/tags/", "POST", { name, slug: name.toLowerCase().replace(/\s+/g, "-") });
      setTags((ts) => [...ts, created]);
    } catch {
      setTags((ts) => [...ts, { id: Date.now(), name, slug: name }]);
    }
  };

  const removeTag = async (tag: Tag) => {
    setTags((ts) => ts.filter((t) => t.id !== tag.id));
    try {
      await apiMutate(`/tags/${tag.slug}/`, "DELETE");
    } catch {}
  };

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold">الأقسام</span>
          <button className="rounded-pill bg-surface px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2">+ قسم جديد</button>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          {sections.map((s) => (
            <div key={s.id} className="flex min-h-[44px] items-center gap-3.5 border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex flex-col gap-0.5 text-[11px] text-header-muted">
                <span onClick={() => move(s.id, -1)} className="cursor-pointer">
                  ▲
                </span>
                <span onClick={() => move(s.id, 1)} className="cursor-pointer">
                  ▼
                </span>
              </div>
              <span className="flex-1 text-[13.5px] font-bold">{s.name_ar}</span>
              <span className="tnum text-xs text-ink-3">{toEasternNumerals(s.article_count)} مقال</span>
              <span className="cursor-pointer text-ink-3">✎</span>
              <span onClick={() => removeSection(s.id)} className="cursor-pointer text-down">
                🗑
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 text-[15px] font-bold">الوسوم</div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t.id} className="flex items-center gap-1.5 rounded-pill bg-brand-tint px-3 py-1.5 text-[12.5px] font-semibold text-brand">
                {t.name}
                <span onClick={() => removeTag(t)} className="cursor-pointer">
                  ✕
                </span>
              </span>
            ))}
          </div>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="أضف وسماً جديداً واضغط Enter"
            className="max-w-[320px] rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </div>
      </div>
    </>
  );
}
