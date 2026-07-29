"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import MediaLibraryPicker from "@/components/dashboard/MediaLibraryPicker";
import TextColorToolbar from "@/components/dashboard/TextColorToolbar";
import { dashMutate, describeApiError, mediaUrl } from "@/lib/api";
import type { ArticleBlock, ArticleDetail, Badge, MediaAsset } from "@/lib/types";

type Block = {
  id: number;
  type: ArticleBlock["type"];
  text: string;
  caption: string;
  credit: string;
  /** Library asset chosen in this session — sent as asset_id. */
  assetId: number | null;
  /** Stored file name of an image the block already had — echoed as keep_image. */
  imageName: string;
  /** Preview URL for whichever of the two above is set. */
  imageUrl: string | null;
};
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
    initial?.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      text: b.text,
      caption: b.caption,
      credit: b.credit,
      assetId: null,
      imageName: b.image_name ?? "",
      imageUrl: mediaUrl(b.image) ?? null,
    })) ?? [{ id: 1, type: "paragraph", text: "", caption: "", credit: "", assetId: null, imageName: "", imageUrl: null }],
  );
  const [nextId, setNextId] = useState((blocks.at(-1)?.id ?? 0) + 1);
  // Keyed by block id, not index, so reordering a block keeps its textarea.
  const bodyRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const [section, setSection] = useState(initial?.section?.key ?? sections[0]?.key ?? "egypt");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [badge, setBadge] = useState<Badge>(initial?.badge ?? "none");
  const [lang, setLang] = useState<"ar" | "en">(initial?.language ?? "ar");
  const [tags, setTags] = useState<string[]>(initial?.tags.map((t) => t.name) ?? []);
  const [tagDraft, setTagDraft] = useState("");
  // Permalink. Blank on a new article means "derive from the title" (the
  // server slugifies Arabic correctly; the browser can't).
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(mediaUrl(initial?.cover_image ?? null) ?? null);
  const [coverAssetId, setCoverAssetId] = useState<number | null>(null);
  // Which spot the library picker is choosing for: a block id, or the cover.
  const [pickerFor, setPickerFor] = useState<number | "cover" | null>(null);
  // Publishing surfaces: pinning is a stored article field; the two pushes
  // are one-shot actions the server performs on this save (published only).
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [pushBreaking, setPushBreaking] = useState(false);
  const [pushStory, setPushStory] = useState(false);
  // Publish-later. datetime-local wants "YYYY-MM-DDTHH:mm" in the editor's
  // own zone; the API stores ISO with offset. Prefilled when editing an
  // already-scheduled story so its time is visible and adjustable.
  const [scheduledFor, setScheduledFor] = useState(() => {
    if (!initial?.scheduled_for || initial.status !== "scheduled") return "";
    const d = new Date(initial.scheduled_for);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [ttsStatus, setTtsStatus] = useState<"idle" | "generating" | "done">(initial?.tts_status ?? "idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    setBlocks((bs) => [...bs, { id: nextId, type, text: "", caption: "", credit: "", assetId: null, imageName: "", imageUrl: null }]);
    setNextId((n) => n + 1);
  };
  const removeBlock = (id: number) => setBlocks((bs) => bs.filter((b) => b.id !== id));

  /**
   * «ضبط المسافات»: split the paragraph at the cursor into two blocks. Long
   * walls of text become separately movable paragraphs with the standard
   * spacing between them, instead of the editor faking distance with blank
   * lines that render inconsistently.
   */
  const splitBlock = (id: number) => {
    const el = bodyRefs.current[id];
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i === -1) return bs;
      const at = el ? el.selectionStart : Math.floor(bs[i].text.length / 2);
      const before = bs[i].text.slice(0, at).trim();
      const after = bs[i].text.slice(at).trim();
      if (!before || !after) return bs;
      const arr = [...bs];
      arr[i] = { ...arr[i], text: before };
      arr.splice(i + 1, 0, { id: nextId, type: "paragraph", text: after, caption: "", credit: "", assetId: null, imageName: "", imageUrl: null });
      return arr;
    });
    setNextId((n) => n + 1);
  };

  const pickAsset = (asset: MediaAsset) => {
    const url = mediaUrl(asset.image) ?? null;
    if (pickerFor === "cover") {
      setCoverAssetId(asset.id);
      setCoverUrl(url);
    } else if (pickerFor !== null) {
      setBlocks((bs) =>
        bs.map((b) =>
          b.id === pickerFor
            ? { ...b, assetId: asset.id, imageName: "", imageUrl: url, credit: b.credit || asset.credit }
            : b,
        ),
      );
    }
    setPickerFor(null);
  };

  const words = wordCount(standfirst) + blocks.filter((b) => b.type === "paragraph").reduce((sum, b) => sum + wordCount(b.text), 0);
  const readMinutes = Math.max(1, Math.ceil(words / 200));

  const generateTts = () => {
    setTtsStatus("generating");
    setTimeout(() => setTtsStatus("done"), 1400);
  };

  const save = async (status: "draft" | "review" | "published" | "scheduled") => {
    setError("");
    if (!title.trim()) {
      setError("لازم تكتب عنوان الخبر أولاً.");
      return;
    }
    if (status === "scheduled") {
      // Guard here, not just in the disabled state: the invalid cases must
      // name themselves, and a silently disabled button names nothing.
      if (!scheduledFor) {
        setError("اختر وقت النشر أولاً.");
        return;
      }
      if (new Date(scheduledFor) <= new Date()) {
        setError("وقت الجدولة لازم يكون في المستقبل — للنشر الفوري استخدم «حفظ ونشر».");
        return;
      }
    }
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
      blocks: blocks.map((b, i) => ({
        order: i,
        type: b.type,
        text: b.text,
        caption: b.caption,
        credit: b.credit,
        ...(b.assetId ? { asset_id: b.assetId } : b.imageName ? { keep_image: b.imageName } : {}),
      })),
      tag_names: tags,
      pinned,
      ...(pushBreaking ? { push_breaking: true } : {}),
      ...(pushStory ? { push_story: true } : {}),
      // Blank slug is omitted so Article.save() derives one from the title —
      // the browser can't slugify Arabic without stripping it to nothing.
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      ...(coverAssetId ? { cover_asset_id: coverAssetId } : {}),
      // ISO with the editor's real offset; null clears a previous schedule
      // when the story is saved any other way, so «مجدول ٩:٠٠» can't linger
      // on an article someone since published by hand.
      scheduled_for: status === "scheduled" ? new Date(scheduledFor).toISOString() : null,
    };
    try {
      if (articleId) {
        await dashMutate(`/articles/${articleId}/`, "PATCH", payload);
      } else {
        await dashMutate("/articles/", "POST", payload);
      }
      router.push("/dashboard/articles");
      router.refresh();
    } catch (err) {
      // A save that fails has to say so, and say why — an editor staring at
      // an unchanged screen with no message can't tell a rejected save from
      // one that's still in flight, and has no idea what to fix either way.
      setError(describeApiError(err, "تعذّر حفظ الخبر. حاول مرة أخرى."));
    } finally {
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `rounded-pill border px-3.5 py-1.5 text-xs font-semibold ${active ? "border-brand bg-brand text-paper" : "border-line bg-paper text-ink"}`;

  return (
    <div className="grid grid-cols-[2.2fr_320px] items-start gap-5 max-lg:grid-cols-1">
      {error ? (
        <div role="alert" className="col-span-2 rounded-card border border-down bg-down-tint px-4 py-3 text-[13px] font-semibold text-down max-lg:col-span-1">
          {error}
        </div>
      ) : null}
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
              <div className="flex items-center gap-2.5 text-xs text-header-muted">
                {b.type === "paragraph" && b.text.trim() ? (
                  <span onClick={() => splitBlock(b.id)} title="تقسيم الفقرة عند المؤشر" className="cursor-pointer font-semibold hover:text-accent">
                    ✂ تقسيم
                  </span>
                ) : null}
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
              <>
                <textarea
                  ref={(el) => {
                    bodyRefs.current[b.id] = el;
                  }}
                  value={b.text}
                  onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                  placeholder={b.type === "paragraph" ? "نص الفقرة" : "نص الاقتباس"}
                  className="min-h-[70px] w-full resize-y rounded-lg border border-line p-2.5 text-[14px] outline-none focus:border-brand"
                />
                <TextColorToolbar
                  value={b.text}
                  onChange={(text: string) => updateBlock(b.id, { text })}
                  textareaRef={{ current: bodyRefs.current[b.id] ?? null }}
                />
              </>
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
                <button
                  type="button"
                  onClick={() => setPickerFor(b.id)}
                  title="اختيار من مكتبة الصور"
                  className="group relative flex h-[100px] w-[140px] flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface text-xs text-header-muted hover:border-accent hover:text-accent"
                >
                  {b.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span>🖼 من المكتبة</span>
                  )}
                  {b.imageUrl ? (
                    <span className="absolute inset-x-0 bottom-0 bg-[rgba(6,38,57,.75)] py-1 text-center text-[10.5px] font-bold text-paper opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                      تغيير الصورة
                    </span>
                  ) : null}
                </button>
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
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">صورة الغلاف</div>
          <button
            type="button"
            onClick={() => setPickerFor("cover")}
            className="group relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface text-xs text-header-muted hover:border-accent hover:text-accent"
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span>🖼 اختيار من مكتبة الصور</span>
            )}
            {coverUrl ? (
              <span className="absolute inset-x-0 bottom-0 bg-[rgba(6,38,57,.75)] py-1.5 text-center text-[11px] font-bold text-paper opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                تغيير الغلاف
              </span>
            ) : null}
          </button>
          <div className="mt-2 text-[11px] leading-relaxed text-ink-3">
            ابحث باسم الصورة أو الشخصية — الصور المرفوعة سابقاً تُعاد بلا رفع جديد وبحقوقها المسجلة.
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[13px] font-bold">الرابط الدائم (Permalink)</div>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            dir="ltr"
            placeholder="يتولّد تلقائياً من العنوان"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-left text-xs outline-none focus:border-brand"
          />
          <div dir="ltr" className="mt-2 truncate text-left text-[11px] text-ink-3">
            /article/{slug.trim() || "…"}
          </div>
          {articleId && initial?.slug && slug.trim() !== initial.slug ? (
            <div className="mt-1.5 text-[11px] font-semibold leading-relaxed text-down">
              تغيير الرابط بعد النشر يكسر أي رابط قديم متداول للخبر.
            </div>
          ) : null}
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
          <div className="mb-2.5 text-[13px] font-bold">النشر والإبراز</div>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[13px] font-semibold text-ink">تثبيت في الرئيسية</span>
              <span className="block text-[11px] leading-relaxed text-ink-3">يتصدّر الخبر واجهة الموقع حتى تلغي التثبيت.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pushBreaking} onChange={(e) => setPushBreaking(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[13px] font-semibold text-ink">إرسال إلى شريط «عاجل»</span>
              <span className="block text-[11px] leading-relaxed text-ink-3">يظهر العنوان في الشريط الأحمر فور الحفظ والنشر.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pushStory} onChange={(e) => setPushStory(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[13px] font-semibold text-ink">إضافة إلى «قصص اليوم»</span>
              <span className="block text-[11px] leading-relaxed text-ink-3">ينضم لشريط القصص أعلى الرئيسية بصورة غلافه.</span>
            </span>
          </label>
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
        <div className="rounded-card border border-line bg-paper p-4">
          <label htmlFor="schedule-at" className="mb-1.5 block text-[12px] font-bold text-ink-3">
            جدولة النشر (اختياري)
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
          {scheduledFor ? (
            <button
              onClick={() => save("scheduled")}
              disabled={saving}
              className="mt-2.5 w-full rounded-lg bg-accent py-2.5 text-[13px] font-bold text-paper hover:bg-accent-strong disabled:opacity-60"
            >
              ⏰ جدولة النشر
            </button>
          ) : (
            <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-ink-3">
              اختر وقتاً وسيُنشر الخبر تلقائياً في موعده — تتحقق اللوحة من المواعيد كل دقيقة.
            </p>
          )}
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

      {pickerFor !== null ? <MediaLibraryPicker onPick={pickAsset} onClose={() => setPickerFor(null)} /> : null}
    </div>
  );
}
