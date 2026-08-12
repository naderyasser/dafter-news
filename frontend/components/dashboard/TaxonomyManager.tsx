"use client";

import { useRef, useState } from "react";

import { dashMutate, dashUpload, mediaUrl } from "@/lib/api";
import { toEasternNumerals } from "@/lib/format";
import type { Section, Tag } from "@/lib/types";

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-brand";

/**
 * Clean up a typed `key`/`slug`, which are ASCII columns.
 *
 * The browser can't derive one from an Arabic name — slugifying «الخليج
 * العربي» strips it to empty — so a new section asks for its key explicitly
 * and this only tidies what was typed.
 */
function toKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TaxonomyManager({
  sections: initialSections,
  tags: initialTags,
}: {
  sections: Section[];
  tags: Tag[];
}) {
  const [sections, setSections] = useState(initialSections);
  const [tags, setTags] = useState(initialTags);
  const [tagDraft, setTagDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [error, setError] = useState("");

  const move = async (id: number, dir: -1 | 1) => {
    const i = sections.findIndex((x) => x.id === id);
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const arr = [...sections];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    // Renumber from 1 so the saved order matches what's on screen — swapping
    // just the two indices left duplicate `order` values behind.
    const renumbered = arr.map((s, idx) => ({ ...s, order: idx + 1 }));
    const before = sections;
    setSections(renumbered);
    try {
      await Promise.all(renumbered.map((s) => dashMutate(`/sections/${s.key}/`, "PATCH", { order: s.order })));
    } catch {
      setSections(before);
      setError("تعذّر حفظ ترتيب الأقسام.");
    }
  };

  const addSection = async (nameAr: string, nameEn: string, key: string) => {
    setError("");
    try {
      const created = await dashMutate<Section>("/sections/", "POST", {
        key,
        name_ar: nameAr,
        name_en: nameEn,
        order: sections.length + 1,
      });
      setSections((ss) => [...ss, created]);
      setAdding(false);
    } catch {
      setError("تعذّر إضافة القسم — تأكد أن المعرّف غير مكرر.");
    }
  };

  const saveSection = async (section: Section, nameAr: string, nameEn: string, tagline: string) => {
    setError("");
    const before = sections;
    setSections((ss) => ss.map((s) => (s.id === section.id ? { ...s, name_ar: nameAr, name_en: nameEn, tagline } : s)));
    setEditingSection(null);
    try {
      await dashMutate(`/sections/${section.key}/`, "PATCH", { name_ar: nameAr, name_en: nameEn, tagline });
    } catch {
      setSections(before);
      setError("تعذّر تعديل القسم.");
    }
  };

  /**
   * The home-page masthead's cover photo. A direct upload straight onto the
   * section (not through the media library) — the same pattern the site's
   * own logo already uses, because this is branding, not editorial content
   * needing a credit/license line.
   */
  const uploadSectionCover = async (section: Section, file: File) => {
    setError("");
    try {
      const form = new FormData();
      form.append("cover_image", file);
      const saved = await dashUpload<Section>(`/sections/${section.key}/`, "PATCH", form);
      setSections((ss) => ss.map((s) => (s.id === section.id ? saved : s)));
      setEditingSection((cur) => (cur && cur.id === section.id ? saved : cur));
    } catch {
      setError("تعذّر رفع صورة الغلاف. تأكد أنها صورة صالحة وحاول مرة أخرى.");
    }
  };

  const removeSectionCover = async (section: Section) => {
    setError("");
    const before = sections;
    setSections((ss) => ss.map((s) => (s.id === section.id ? { ...s, cover_image: null } : s)));
    setEditingSection((cur) => (cur && cur.id === section.id ? { ...cur, cover_image: null } : cur));
    try {
      await dashMutate(`/sections/${section.key}/`, "PATCH", { cover_image: null });
    } catch {
      setSections(before);
      setError("تعذّر إزالة صورة الغلاف.");
    }
  };

  const removeSection = async (section: Section) => {
    const warning = section.article_count
      ? `«${section.name_ar}» فيه ${section.article_count} مقال. الحذف سيفشل ما لم تنقلها أولاً. متابعة؟`
      : `حذف «${section.name_ar}»؟`;
    if (!confirm(warning)) return;
    setError("");
    const before = sections;
    setSections((ss) => ss.filter((x) => x.id !== section.id));
    try {
      await dashMutate(`/sections/${section.key}/`, "DELETE");
    } catch {
      // Article.section is on_delete=PROTECT, so a section still holding
      // articles legitimately refuses to go. Put it back and say why.
      setSections(before);
      setError("تعذّر حذف القسم — انقل مقالاته إلى قسم آخر أولاً.");
    }
  };

  const addTag = async () => {
    const name = tagDraft.trim();
    if (!name) return;
    setError("");
    setTagDraft("");
    try {
      // An Arabic name slugifies to nothing, so fall back to a unique key the
      // API will accept rather than posting an empty slug.
      const slug = toKey(name) || `tag-${Date.now()}`;
      const created = await dashMutate<Tag>("/tags/", "POST", { name, slug });
      setTags((ts) => [...ts, created]);
    } catch {
      setError("تعذّر إضافة الوسم.");
    }
  };

  const renameTag = async (tag: Tag, name: string) => {
    setError("");
    const before = tags;
    setTags((ts) => ts.map((t) => (t.id === tag.id ? { ...t, name } : t)));
    setEditingTag(null);
    try {
      await dashMutate(`/tags/${tag.slug}/`, "PATCH", { name });
    } catch {
      setTags(before);
      setError("تعذّر تعديل الوسم.");
    }
  };

  const removeTag = async (tag: Tag) => {
    if (!confirm(`حذف الوسم «${tag.name}»؟ سيختفي فوراً من صفحات الأرشيف والبحث.`)) return;
    setError("");
    const before = tags;
    setTags((ts) => ts.filter((t) => t.id !== tag.id));
    try {
      await dashMutate(`/tags/${tag.slug}/`, "DELETE");
    } catch {
      setTags(before);
      setError("تعذّر حذف الوسم.");
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down">
          {error}
        </div>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[15px] font-bold">الأقسام</span>
          <button
            onClick={() => setAdding(true)}
            className="rounded-pill bg-surface px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2"
          >
            + قسم جديد
          </button>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          {sections.map((s, i) => (
            <div key={s.id} className="flex min-h-[44px] items-center gap-3.5 border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex flex-col gap-0.5 text-[11px] text-header-muted">
                <button onClick={() => move(s.id, -1)} disabled={i === 0} aria-label={`تحريك ${s.name_ar} لأعلى`} className="disabled:opacity-30">
                  ▲
                </button>
                <button
                  onClick={() => move(s.id, 1)}
                  disabled={i === sections.length - 1}
                  aria-label={`تحريك ${s.name_ar} لأسفل`}
                  className="disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
              <span className="flex-1 text-[13.5px] font-bold">{s.name_ar}</span>
              <span className="text-[11px] text-ink-3" dir="ltr">
                {s.key}
              </span>
              {/* Counted server-side off the article table. */}
              <span className="tnum text-xs text-ink-3">{toEasternNumerals(s.article_count)} مقال</span>
              <button onClick={() => setEditingSection(s)} aria-label={`تعديل ${s.name_ar}`} className="text-ink-3 hover:text-brand">
                ✎
              </button>
              <button onClick={() => removeSection(s)} aria-label={`حذف ${s.name_ar}`} className="text-down">
                🗑
              </button>
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
                <button onClick={() => setEditingTag(t)} title="تعديل الوسم" className="hover:underline">
                  {t.name}
                </button>
                <button onClick={() => removeTag(t)} aria-label={`حذف ${t.name}`}>
                  ✕
                </button>
              </span>
            ))}
            {tags.length === 0 && <span className="text-[12.5px] text-ink-3">لا توجد وسوم بعد</span>}
          </div>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTag()}
            placeholder="أضف وسماً جديداً واضغط Enter"
            className="max-w-[320px] rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
          <p className="m-0 mt-2 text-[11.5px] text-ink-3">الوسوم تظهر فوراً في البحث الداخلي وصفحات الأرشيف (‎/tag/…‎).</p>
        </div>
      </div>

      {adding && <SectionDialog title="قسم جديد" onCancel={() => setAdding(false)} onSave={addSection} />}
      {editingSection && (
        <SectionDialog
          title="تعديل القسم"
          section={editingSection}
          onCancel={() => setEditingSection(null)}
          onSave={(ar, en, _key, tagline) => saveSection(editingSection, ar, en, tagline)}
          onUploadCover={(file) => uploadSectionCover(editingSection, file)}
          onRemoveCover={() => removeSectionCover(editingSection)}
        />
      )}
      {editingTag && <TagDialog tag={editingTag} onCancel={() => setEditingTag(null)} onSave={(name) => renameTag(editingTag, name)} />}
    </>
  );
}

function Modal({ label, onCancel, children }: { label: string; onCancel: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,11,13,.55)] p-4" onClick={onCancel} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in w-full max-w-[420px] rounded-card bg-paper p-5 shadow-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">{label}</span>
          <button onClick={onCancel} aria-label="إغلاق" className="text-[18px] leading-none text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SectionDialog({
  title,
  section,
  onCancel,
  onSave,
  onUploadCover,
  onRemoveCover,
}: {
  title: string;
  section?: Section;
  onCancel: () => void;
  onSave: (nameAr: string, nameEn: string, key: string, tagline: string) => void;
  onUploadCover?: (file: File) => Promise<void>;
  onRemoveCover?: () => void;
}) {
  const [nameAr, setNameAr] = useState(section?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(section?.name_en ?? "");
  const [key, setKey] = useState(section?.key ?? "");
  const [tagline, setTagline] = useState(section?.tagline ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !section;
  const canSave = nameAr.trim().length > 0 && (!isNew || toKey(key).length > 1);

  const pickFile = async (file: File) => {
    if (!onUploadCover) return;
    setUploading(true);
    try {
      await onUploadCover(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal label={title} onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-ink-3">الاسم بالعربية</span>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold text-ink-3">الاسم بالإنجليزية</span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" className={`${input} text-start`} />
        </label>
        {!isNew && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">الوصف المختصر (فوق صورة الغلاف بالرئيسية)</span>
            <textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              rows={2}
              maxLength={200}
              className={`${input} resize-none`}
            />
          </label>
        )}
        {!isNew && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">صورة غلاف القسم (بانر الرئيسية)</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex h-[64px] w-[112px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface p-1 text-[11px] text-ink-3 hover:border-brand hover:text-brand disabled:opacity-60"
              >
                {uploading ? (
                  "جارٍ الرفع…"
                ) : section!.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(section!.cover_image) ?? ""} alt="" className="h-full w-full object-cover" />
                ) : (
                  "ارفع صورة"
                )}
              </button>
              {section!.cover_image && onRemoveCover && (
                <button type="button" onClick={onRemoveCover} className="text-[12px] font-semibold text-down hover:underline">
                  إزالة الصورة
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
                e.target.value = "";
              }}
            />
            <span className="text-[11px] text-ink-3">بدون صورة، يظل عنوان القسم البسيط كما هو في الرئيسية.</span>
          </div>
        )}
        {isNew ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">المعرّف (يظهر في الرابط)</span>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onBlur={(e) => setKey(toKey(e.target.value))}
              placeholder="gulf"
              dir="ltr"
              className={`${input} text-start`}
            />
            <span className="text-[11px] text-ink-3">إنجليزي فقط — سيصبح ‎/section/{toKey(key) || "…"}‎</span>
          </label>
        ) : (
          // The key is the URL segment and the API lookup, so changing it under
          // an existing section breaks every /section/… link already published.
          <div className="rounded-lg bg-surface px-3 py-2 text-[11.5px] text-ink-3">
            المعرّف <span dir="ltr">{section.key}</span> ثابت — تغييره يكسر الروابط المنشورة.
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
          إلغاء
        </button>
        <button
          onClick={() => onSave(nameAr.trim(), nameEn.trim(), toKey(key), tagline.trim())}
          disabled={!canSave}
          className="rounded-lg bg-brand px-4.5 py-2 text-[13px] font-bold text-paper hover:bg-brand-strong disabled:opacity-50"
        >
          حفظ
        </button>
      </div>
    </Modal>
  );
}

function TagDialog({ tag, onCancel, onSave }: { tag: Tag; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(tag.name);
  return (
    <Modal label="تعديل الوسم" onCancel={onCancel}>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-bold text-ink-3">اسم الوسم</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <div className="mt-5 flex justify-end gap-2.5">
        <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
          إلغاء
        </button>
        <button
          onClick={() => onSave(name.trim())}
          disabled={!name.trim()}
          className="rounded-lg bg-brand px-4.5 py-2 text-[13px] font-bold text-paper hover:bg-brand-strong disabled:opacity-50"
        >
          حفظ
        </button>
      </div>
    </Modal>
  );
}
