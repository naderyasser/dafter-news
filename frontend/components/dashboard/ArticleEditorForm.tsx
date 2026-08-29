"use client";

import { useRouter } from "next/navigation";
import { DASHBOARD } from "@/lib/routes";
import { useRef, useState } from "react";

import ImportFromUrl, { type ImportedDraft } from "@/components/dashboard/ImportFromUrl";
import MediaLibraryPicker from "@/components/dashboard/MediaLibraryPicker";
import RichTextEditor, { type RichTextEditorHandle } from "@/components/dashboard/RichTextEditor";
import TextColorToolbar from "@/components/dashboard/TextColorToolbar";
import { dashMutate, dashUpload, describeApiError, mediaUrl } from "@/lib/api";
import { revalidateSite } from "@/lib/revalidate";
import { getVisibleSelection } from "@/lib/richTextDom";
import { rawOffsetFromVisible, stripInline } from "@/lib/richtext";
import type { ArticleBlock, ArticleDetail, Badge, MediaAsset } from "@/lib/types";

type Block = {
  id: number;
  type: ArticleBlock["type"];
  text: string;
  caption: string;
  credit: string;
  /** Left/center/right/justify — paragraph blocks only. */
  align: ArticleBlock["align"];
  /** Library asset chosen in this session — sent as asset_id. */
  assetId: number | null;
  /** Stored file name of an image the block already had — echoed as keep_image. */
  imageName: string;
  /** Preview URL for whichever of the two above is set. */
  imageUrl: string | null;
};

/** A freshly created block, defaults filled in. */
const blankBlock = (id: number, type: Block["type"], text = ""): Block => ({
  id,
  type,
  text,
  caption: "",
  credit: "",
  // Justify — a consistent right-and-left edge reads as typeset rather
  // than ragged, matching the client's "avoid random line lengths" ask.
  align: "justify",
  assetId: null,
  imageName: "",
  imageUrl: null,
});

const ALIGN_OPTIONS: { key: ArticleBlock["align"]; label: string }[] = [
  { key: "left", label: "محاذاة اليسار" },
  { key: "center", label: "محاذاة الوسط" },
  { key: "right", label: "محاذاة اليمين" },
  { key: "justify", label: "ضبط" },
];

/**
 * The word-processor alignment glyph — three bars of varying width laid out
 * per `align`, matching the client's own reference image exactly rather
 * than approximating it with a generic icon.
 */
function AlignIcon({ align, className = "h-4 w-4" }: { align: ArticleBlock["align"]; className?: string }) {
  const widths = [16, 11, 13];
  const x = (w: number) => {
    if (align === "left") return 1;
    if (align === "right") return 19 - w;
    if (align === "justify") return 1;
    return (20 - w) / 2;
  };
  return (
    <svg viewBox="0 0 20 14" fill="none" aria-hidden className={className}>
      {widths.map((w, i) => (
        <rect key={i} x={x(align === "justify" ? 18 : w)} y={1 + i * 5} width={align === "justify" ? 18 : w} height={2} rx={1} fill="currentColor" />
      ))}
    </svg>
  );
}
export type EditorSection = { id: number; key: string; label: string };
export type EditorAuthor = { id: number; username: string; name: string; title: string; avatar: string | null };

const BADGES: { key: Badge; label: string }[] = [
  { key: "none", label: "بدون" },
  { key: "breaking", label: "عاجل" },
  { key: "exclusive", label: "خاص" },
  { key: "live", label: "مباشر" },
];
const BLOCK_LABELS: Record<Block["type"], string> = { paragraph: "المحتوى", heading: "عنوان فرعي", image: "صورة", quote: "اقتباس", related: "اقرأ أيضاً" };

/**
 * The per-block toolbar controls. These were `<span onClick>` in muted
 * 12px grey — invisible to the keyboard, unannounced by assistive tech,
 * and visually indistinguishable from the block's own caption text.
 * `PRIMARY` is the filled variant the in-body image actions use so they
 * read as the buttons they are.
 */
const BLOCK_TOOL_CLASS =
  "rounded-md border border-line px-2 py-1 text-[12.5px] font-semibold text-ink-2 transition-colors duration-fast hover:border-accent hover:text-accent";
const BLOCK_TOOL_PRIMARY_CLASS =
  "rounded-md border border-accent bg-accent-tint px-2 py-1 text-[12.5px] font-bold text-accent transition-colors duration-fast hover:bg-accent hover:text-paper";

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function ArticleEditorForm({
  initial,
  articleId,
  sections,
  authors = [],
}: {
  initial: ArticleDetail | null;
  articleId?: number;
  sections: EditorSection[];
  authors: EditorAuthor[];
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
      align: b.align ?? "justify",
      assetId: null,
      imageName: b.image_name ?? "",
      imageUrl: mediaUrl(b.image) ?? null,
    })) ?? [blankBlock(1, "paragraph")],
  );
  const [nextId, setNextId] = useState((blocks.at(-1)?.id ?? 0) + 1);
  // Which paragraph/quote the reader is currently in — the one static
  // toolbar above the body acts on this one, via richRefs below, instead of
  // every block carrying its own copy of the same buttons. Defaults to the
  // first block: opening the editor (or a fresh one, which starts with
  // exactly one block) puts the toolbar to work immediately, with nothing
  // to click first.
  const [activeBlockId, setActiveBlockId] = useState<number | null>(blocks[0]?.id ?? null);
  // Keyed by block id — lets the shared toolbar drive whichever
  // RichTextEditor instance is `activeBlockId` right now.
  const richRefs = useRef<Record<number, RichTextEditorHandle | null>>({});
  // Keyed by block id, not index, so reordering a block keeps its field.
  const bodyRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // Keyed the same way, for the "upload from device" file input on each image block.
  const imageFileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  // «+ صورة»'s own "رفع من الجهاز" file input — one shared input in the
  // single static toolbar rather than one per paragraph/quote block, since
  // it only ever acts on whichever one is active (pendingInlineUpload below
  // carries which block and cursor offset for it).
  const inlineImageFileRef = useRef<HTMLInputElement | null>(null);
  // Where the cursor was when insertInlineImageFromDevice was clicked, for
  // uploadInlineImage's onChange handler to insert into once a file lands.
  const pendingInlineUpload = useRef<{ blockId: number; offset: number } | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  const [section, setSection] = useState(initial?.section?.key ?? sections[0]?.key ?? "egypt");
  // «اسم الكاتب» — يُكتب يدوياً، اختياري. منفصل عن حساب Article.author (نظام
  // «بالعقل والمنطق»/الكتّاب المسجّلين) — هذا مجرد اسم يظهر تحت العنوان بلا
  // حاجة لإنشاء حساب.
  const [byline, setByline] = useState(initial?.byline ?? "");
  // Linked columnist account — separate from `byline` above (see that
  // field's own comment). This is the FK the opinion page's author card,
  // avatar and profile link are actually built on; a plain byline has none
  // of those. Defaults to whatever this article already carries.
  const [authorId, setAuthorId] = useState<number | "">(initial?.author?.id ?? "");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [badge, setBadge] = useState<Badge>(initial?.badge ?? "none");
  const [lang, setLang] = useState<"ar" | "en">(initial?.language ?? "ar");
  const [tags, setTags] = useState<string[]>(initial?.tags.map((t) => t.name) ?? []);
  const [tagDraft, setTagDraft] = useState("");
  // Permalink. Blank on a new article means "derive from the title" (the
  // server slugifies Arabic correctly; the browser can't).
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [coverUrl, setCoverUrl] = useState<string | null>(mediaUrl(initial?.cover_image ?? null) ?? null);
  const [coverAssetId, setCoverAssetId] = useState<number | null>(null);
  // Which spot the library picker is choosing for: a block id (the block's
  // own image), the cover, or a cursor position inside a block's content
  // («+ صورة» — an image dropped mid-paragraph rather than the block's own).
  const [pickerFor, setPickerFor] = useState<number | "cover" | { blockId: number; offset: number } | null>(null);
  // Which block's alignment menu is open.
  const [alignMenuFor, setAlignMenuFor] = useState<number | null>(null);
  // Publishing surfaces: the two pushes are one-shot actions the server
  // performs on this save (published only). Homepage pinning used to be a
  // third checkbox here; removed on request, keeping these two.
  const [pushBreaking, setPushBreaking] = useState(false);
  const [pushStory, setPushStory] = useState(false);
  // «تثبيت في الرئيسية» — leads the home hero regardless of publish time,
  // and (per the client) its own section's front too; both read pinned
  // straight off the article, not a copy kept here.
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  // The site-wide floating popup (SiteFooter mounts it on every page) —
  // distinct from `badge`, which only decorates this article's own card.
  // Stored on the article itself (not a one-shot push), so it round-trips
  // when re-opening a published urgent story to edit it.
  const [notifyUrgent, setNotifyUrgent] = useState(initial?.notify_urgent ?? false);
  const [notifyLabel, setNotifyLabel] = useState(initial?.notify_label ?? "خبر عاجل");
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
  const [ttsDuration, setTtsDuration] = useState(initial?.tts_duration_seconds ?? 0);
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
  /** Inserts right after whichever block the reader is currently in — the
   *  word-processor "type here, insert there" expectation — falling back to
   *  the end when nothing is active (e.g. before anything has been focused). */
  const addBlock = (type: Block["type"]) => {
    const newId = nextId;
    setBlocks((bs) => {
      const i = activeBlockId != null ? bs.findIndex((b) => b.id === activeBlockId) : -1;
      const insertAt = i === -1 ? bs.length : i + 1;
      const arr = [...bs];
      arr.splice(insertAt, 0, blankBlock(newId, type));
      return arr;
    });
    setNextId((n) => n + 1);
    setActiveBlockId(newId);
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
    // Read the field's live selection now, at click time — the field itself
    // (a contentEditable) only ever knows PLAIN-text offsets, so this needs
    // rawOffsetFromVisible to land on the equivalent spot in the block's
    // actual (possibly coloured/formatted) stored text.
    const vis = el ? getVisibleSelection(el) : null;
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i === -1) return bs;
      const text = bs[i].text;
      const visAt = vis ? vis.start : Math.floor(stripInline(text).length / 2);
      const at = rawOffsetFromVisible(text, visAt);
      const before = text.slice(0, at).trim();
      const after = text.slice(at).trim();
      if (!before || !after) return bs;
      const arr = [...bs];
      arr[i] = { ...arr[i], text: before };
      // The new half keeps whatever alignment the original paragraph had.
      arr.splice(i + 1, 0, { ...blankBlock(nextId, "paragraph", after), align: arr[i].align });
      return arr;
    });
    setNextId((n) => n + 1);
  };

  /**
   * RichTextEditor's `onSplitPaste` — a paste spanning more than one line
   * lands here instead of one field. Same shape as splitBlock: the current
   * block keeps its id and takes `before + lines[0]`, every line in between
   * becomes its own new block, and the last merges with whatever was after
   * the cursor. All the new blocks inherit the source block's type and
   * alignment, same as splitBlock's own half does.
   */
  const pasteAsBlocks = (id: number, before: string, lines: string[], after: string) => {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id);
      if (i === -1) return bs;
      const { type, align } = bs[i];
      let nid = nextId;
      const replacement: Block[] = [{ ...bs[i], text: before + lines[0] }];
      for (let k = 1; k < lines.length - 1; k++) {
        replacement.push({ ...blankBlock(nid++, type, lines[k]), align });
      }
      replacement.push({ ...blankBlock(nid++, type, lines[lines.length - 1] + after), align });
      const arr = [...bs];
      arr.splice(i, 1, ...replacement);
      setNextId(nid);
      return arr;
    });
  };

  /**
   * «+ صورة» — «بدي اقدر اضيف صورة بين الكلام»: drop an image into the
   * block's own text at the cursor, so it sits between two sentences
   * instead of only ever before/after the block as a whole.
   *
   * The library picker is a modal, which steals focus the moment it opens —
   * by the time an editor has picked an asset, the field's own selection is
   * long gone. So the cursor position is read right now, at click time
   * (same reasoning as splitBlock), and carried in
   * `pickerFor` for pickAsset to insert at once the picker returns. No
   * selection at all (field not focused) falls back to the end of the text,
   * same spirit as "append" rather than a guess at the middle.
   */
  const captureInsertOffset = (id: number): number | null => {
    const block = blocks.find((b) => b.id === id);
    if (!block) return null;
    const el = bodyRefs.current[id];
    const vis = el ? getVisibleSelection(el) : null;
    const visibleAt = vis ? vis.start : stripInline(block.text).length;
    return rawOffsetFromVisible(block.text, visibleAt);
  };

  const insertInlineImage = (id: number) => {
    const offset = captureInsertOffset(id);
    if (offset === null) return;
    setPickerFor({ blockId: id, offset });
  };

  /** «رفع من الجهاز» half of «+ صورة» — captures the cursor the same way
   *  insertInlineImage does, then hands off to the block's own hidden file
   *  input (uploadInlineImage does the actual upload once a file is picked). */
  const insertInlineImageFromDevice = (id: number) => {
    const offset = captureInsertOffset(id);
    if (offset === null) return;
    pendingInlineUpload.current = { blockId: id, offset };
    inlineImageFileRef.current?.click();
  };

  const pickAsset = (asset: MediaAsset) => {
    const url = mediaUrl(asset.image) ?? null;
    if (pickerFor === "cover") {
      setCoverAssetId(asset.id);
      setCoverUrl(url);
    } else if (typeof pickerFor === "object" && pickerFor !== null) {
      // «+ صورة» — drop the picked asset into the block's own text as an
      // `{img:…}` token at the cursor position captured when the button was
      // clicked (see insertInlineImage), rather than into the block's own
      // dedicated image field.
      const { blockId, offset } = pickerFor;
      setBlocks((bs) =>
        bs.map((b) => (b.id === blockId ? { ...b, text: b.text.slice(0, offset) + `{img:${asset.image}}` + b.text.slice(offset) } : b)),
      );
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

  /**
   * Every upload needs a real name, not the camera's own filename — «كل
   * صورة تنرفع يكون الها اسم بحيث يكون في ترتيب بداتا الموقع»: the media
   * library is searched by name (see MediaLibraryPicker), so an asset filed
   * under "IMG_20260512_finalfinal2" is effectively unfindable later. Null
   * means the editor cancelled — callers must not upload without a name
   * rather than silently falling back to the filename.
   */
  const promptForImageTitle = (file: File): string | null => {
    const suggested = file.name.replace(/\.[^.]+$/, "");
    const name = window.prompt("اسم الصورة (يساعد على ترتيب المكتبة والبحث عنها لاحقاً):", suggested);
    if (name === null) return null;
    return name.trim() || suggested;
  };

  /**
   * «رفع صورة من الجهاز» for an in-body image block. Uploads straight to the
   * media library (same endpoint MediaManager's own uploader uses) and then
   * points the block at the created asset — so a photo dropped mid-article
   * also becomes a reusable library asset rather than a one-off file only
   * this block can see.
   */
  const uploadBlockImage = async (id: number, file: File) => {
    const title = promptForImageTitle(file);
    if (title === null) return;
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("title", title);
      const created = await dashUpload<MediaAsset>("/media/", "POST", form);
      updateBlock(id, {
        assetId: created.id,
        imageName: "",
        imageUrl: mediaUrl(created.image) ?? null,
        credit: created.credit,
      });
    } catch {
      setError("تعذّر رفع الصورة. تأكد من نوع الملف وحاول مرة أخرى.");
    }
  };

  /** Same upload, for the cover slot. */
  const uploadCoverImage = async (file: File) => {
    const title = promptForImageTitle(file);
    if (title === null) return;
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("title", title);
      const created = await dashUpload<MediaAsset>("/media/", "POST", form);
      setCoverAssetId(created.id);
      setCoverUrl(mediaUrl(created.image) ?? null);
    } catch {
      setError("تعذّر رفع الصورة. تأكد من نوع الملف وحاول مرة أخرى.");
    }
  };

  /**
   * Same upload again, for «+ صورة»'s "رفع من الجهاز" — inserted as an
   * `{img:…}` token at the cursor position captured when the button was
   * clicked (see insertInlineImage's own doc comment for why that has to
   * happen before the async upload, not after).
   */
  const uploadInlineImage = async (id: number, offset: number, file: File) => {
    const title = promptForImageTitle(file);
    if (title === null) return;
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("title", title);
      const created = await dashUpload<MediaAsset>("/media/", "POST", form);
      setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, text: b.text.slice(0, offset) + `{img:${created.image}}` + b.text.slice(offset) } : b)));
    } catch {
      setError("تعذّر رفع الصورة. تأكد من نوع الملف وحاول مرة أخرى.");
    }
  };

  /**
   * «استيراد من رابط» hands back a draft's fields, not a saved article —
   * this loads them into the same state a person typing them in by hand
   * would produce, so nothing about the save/review/publish flow below
   * needs to know an import happened at all.
   */
  const applyImportedDraft = (draft: ImportedDraft) => {
    setTitle(draft.title);
    setStandfirst(draft.standfirst);
    setByline(draft.byline);
    let id = nextId;
    // One block, not one per source <p> — a scraped page often runs one
    // sentence per tag, which would hand the editor a wall of tiny boxes to
    // fight with. Merged into a single block, the editor keeps the ✂ تقسيم
    // tool to split it wherever they actually want a break.
    const body = draft.paragraphs.join(" ").trim();
    setBlocks([blankBlock(id++, "paragraph", body)]);
    setNextId(id);
    if (draft.cover_asset_id) {
      setCoverAssetId(draft.cover_asset_id);
      setCoverUrl(mediaUrl(draft.cover_image) ?? null);
    }
  };

  const words = wordCount(standfirst) + blocks.filter((b) => b.type === "paragraph").reduce((sum, b) => sum + wordCount(b.text), 0);
  const readMinutes = Math.max(1, Math.ceil(words / 200));

  /**
   * Was a `setTimeout` that flipped `ttsStatus` to "done" after 1.4s with
   * nothing behind it — «استمع للمقال» never had real audio, it just looked
   * generated. Runs the real narration synchronously (a few seconds for a
   * typical article) against the article as already saved on the server —
   * which is why the button is disabled until the article has an id.
   */
  const generateTts = async () => {
    if (!articleId) return;
    setError("");
    setTtsStatus("generating");
    try {
      const res = await dashMutate<{ tts_status: "idle" | "generating" | "done"; tts_duration_seconds: number }>(
        `/articles/${articleId}/generate_tts/`,
        "POST",
      );
      setTtsStatus("done");
      setTtsDuration(res.tts_duration_seconds);
    } catch (err) {
      setTtsStatus("idle");
      setError(describeApiError(err, "تعذّر توليد الصوت. تأكد أن المقال فيه نص كافٍ وحاول مرة أخرى."));
    }
  };

  const save = async (status: "draft" | "review" | "published" | "scheduled") => {
    setError("");
    if (!title.trim()) {
      setError("لازم تكتب عنوان الخبر أولاً.");
      return;
    }
    // A draft, or a story still in review/scheduled, can legitimately be a
    // headline-only stub an editor is still building out — but nothing
    // should ever go live with no real content. Without this, deleting the
    // one starter block (or never typing into it) and hitting «حفظ ونشر»
    // published a headline straight to the public site with nothing behind
    // it: a card on the homepage that opened to a blank page.
    if (status === "published") {
      const hasContent = blocks.some((b) => (b.type === "image" ? b.assetId || b.imageName : stripInline(b.text).trim()));
      if (!hasContent) {
        setError("الخبر لسه من غير محتوى — اكتب فقرة واحدة على الأقل قبل النشر.");
        return;
      }
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
    // «بالعقل والمنطق» reads by kind="opinion", not by section — the homepage
    // carousel and /opinion both query kind, never section__key (see
    // app/page.tsx and app/opinion/page.tsx). This form only ever exposes the
    // section chip, so an article filed under that section stayed kind="news"
    // and was invisible on both: published clean, shown nowhere.
    const kind = section === "opinion" ? "opinion" : "news";
    const payload = {
      title,
      standfirst,
      status,
      badge,
      pinned,
      notify_urgent: notifyUrgent,
      notify_label: notifyLabel.trim() || "خبر عاجل",
      language: lang,
      section: sectionId,
      kind,
      byline: byline.trim(),
      author: authorId === "" ? null : authorId,
      subcategory: subcategory.trim(),
      country: country.trim(),
      blocks: blocks.map((b, i) => ({
        order: i,
        type: b.type,
        text: b.text,
        align: b.align,
        caption: b.caption,
        credit: b.credit,
        ...(b.assetId ? { asset_id: b.assetId } : b.imageName ? { keep_image: b.imageName } : {}),
      })),
      tag_names: tags,
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
      let savedId = articleId;
      if (articleId) {
        await dashMutate(`/articles/${articleId}/`, "PATCH", payload);
      } else {
        const created = await dashMutate<{ id: number }>("/articles/", "POST", payload);
        savedId = created.id;
      }
      // The public home page/section blocks cache for up to a minute
      // (revalidate=60) — without this, a story published just now (or one
      // just pinned/unpinned) doesn't show up there until that window
      // happens to lapse, which reads as "the save didn't really work."
      // Fire-and-forget: a failed revalidation must never block the save
      // that already landed.
      revalidateSite().catch(() => {});
      // «سماع الخبر» needs real narration behind it the moment a story goes
      // live — publishing used to leave tts_audio empty until someone also
      // remembered the separate «توليد النسخة الصوتية» button below, which
      // is exactly why the player showed a silent demo transport on every
      // article the newsroom actually shipped. Fire-and-forget like the
      // revalidation above: narration takes a few seconds and a failed run
      // (a bad wire to the voice engine) must never block or fail a save
      // that already landed — the manual button stays as a retry path.
      if (status === "published" && savedId) {
        try {
          // Optional chaining on the promise itself, not just the call: this
          // must never throw its way into the surrounding try/catch below
          // and get reported as "تعذّر حفظ الخبر" for a save that already
          // succeeded, whatever dashMutate does under the hood.
          dashMutate(`/articles/${savedId}/generate_tts/`, "POST")?.catch?.(() => {});
        } catch {
          /* best-effort — see comment above */
        }
      }
      router.push(`${DASHBOARD}/articles?saved=1`);
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

  // The single static toolbar above the body acts on whichever paragraph/
  // quote is currently active, rather than every block growing its own copy
  // of the same buttons.
  const activeBlock = blocks.find((b) => b.id === activeBlockId);
  const canFormatActive = activeBlock?.type === "paragraph" || activeBlock?.type === "quote";
  // Splitting and lifting a heading out only ever made sense for a paragraph
  // that actually has something in it — same guard the old per-block button
  // used (`b.type === "paragraph" && b.text.trim()`).
  // «✂ تقسيم» only ever made sense on a paragraph that actually has
  // something in it — same guard the block-splitting «عنوان فرعي» tool used
  // to share with it, before that became an inline style instead (see
  // TextColorToolbar).
  const canSplitActive = activeBlock?.type === "paragraph" && activeBlock.text.trim().length > 0;

  const applyActiveFormat = (kind: "c" | "h" | "b" | "i" | "u" | "L" | "H", color?: string) => {
    if (activeBlockId == null || !canFormatActive) {
      window.alert("اضغط داخل فقرة أو اقتباس أولاً.");
      return;
    }
    richRefs.current[activeBlockId]?.applyFormat(kind, color);
  };
  const clearActiveFormat = () => {
    if (activeBlockId == null) return;
    richRefs.current[activeBlockId]?.clearFormat();
  };
  const splitActive = () => activeBlockId != null && splitBlock(activeBlockId);
  const insertActiveInlineImage = () => activeBlockId != null && insertInlineImage(activeBlockId);
  const insertActiveInlineImageFromDevice = () => activeBlockId != null && insertInlineImageFromDevice(activeBlockId);
  // The client's actual workaround for the missing author-link feature was
  // uploading the columnist's own face as the cover image — the only image
  // field the editor had before «الكاتب المسجّل» existed. Once a linked
  // author with a real photo is chosen for an opinion piece, the cover
  // image field has nothing left to do (the opinion page never renders
  // one — see OpinionCard/OpinionFront), so it's replaced with an
  // explanation rather than left sitting there as a second, redundant
  // place to put the same photo.
  const selectedAuthorAvatar = authors.find((a) => a.id === authorId)?.avatar ?? null;
  const coverReplacedByAuthorPhoto = section === "opinion" && !!selectedAuthorAvatar;

  return (
    <>
    {/* New-article only — importing into an already-saved/published article
        doesn't make sense the same way. */}
    {!articleId ? <ImportFromUrl onImported={applyImportedDraft} /> : null}
    <div className="grid grid-cols-[2.2fr_320px] items-start gap-5 max-lg:grid-cols-1">
      {error ? (
        <div role="alert" className="col-span-2 rounded-card border border-down bg-down-tint px-4 py-3 text-[14px] font-semibold text-down max-lg:col-span-1">
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

        {/*
          One continuous editing surface for the whole body — a single static
          toolbar governs whichever paragraph/quote currently has the cursor
          (activeBlockId + richRefs), instead of every paragraph carrying its
          own bordered card and its own copy of the same buttons. Pasting a
          long article (see RichTextEditor's onPaste) now lands entirely
          inside this one box, with no visible seams between paragraphs.

          Structurally the body is still one Article­Block per paragraph
          underneath — that's what gives the public page real <p> tags,
          per-paragraph alignment, captions/credit on photos, the mid-article
          «أخبار ذات صلة» box and its pagination. Only the editing chrome is
          unified; nothing about how a saved article renders changes.
        */}
        <div className="rounded-card border border-line">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-card border-b border-line bg-surface px-3.5 py-2.5">
            {/* B/I/U/«فقرة»/colour — the exact set every paragraph used to
                render its own copy of underneath its own field. One shared
                instance now, driven by whichever block is active. */}
            <fieldset disabled={!canFormatActive} className="contents">
              <TextColorToolbar embedded value={canFormatActive && activeBlock ? activeBlock.text : ""} onApply={applyActiveFormat} onClear={clearActiveFormat} />
            </fieldset>
            <span className="h-5 w-px bg-line" aria-hidden />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={splitActive}
              disabled={!canSplitActive}
              title="تقسيم الفقرة النشطة عند موضع المؤشر"
              className={`${BLOCK_TOOL_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              ✂ تقسيم
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertActiveInlineImage}
              disabled={!canFormatActive}
              title="إضافة صورة من المكتبة عند موضع المؤشر في الفقرة النشطة"
              className={`${BLOCK_TOOL_PRIMARY_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              🖼 صورة من المكتبة
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={insertActiveInlineImageFromDevice}
              disabled={!canFormatActive}
              title="رفع صورة من الجهاز عند موضع المؤشر في الفقرة النشطة"
              className={`${BLOCK_TOOL_PRIMARY_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              ⬆ صورة داخل المقال
            </button>
            <input
              ref={inlineImageFileRef}
              type="file"
              accept="image/*"
              aria-label="رفع صورة داخل النص من الجهاز"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                const pending = pendingInlineUpload.current;
                if (f && pending) uploadInlineImage(pending.blockId, pending.offset, f);
                pendingInlineUpload.current = null;
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex flex-col px-3.5 py-3">
            {blocks.map((b) => (
              <div key={b.id} className="group relative">
                {/*
                  Per-paragraph controls (align/move/delete) — a floating
                  overlay in the block's own top corner, invisible until
                  hover/focus, so nothing about them ever occupies a row of
                  its own or separates one paragraph from the next. No label
                  either: paragraph is the default shape and needs none; a
                  heading/quote/image/related block already reads as what it
                  is from its own styling below, per the client's explicit
                  "zero UI elements interrupting the text flow" ask.
                */}
                <div className="pointer-events-none absolute top-1 end-1 z-10 flex items-center gap-1 rounded-md border border-line bg-paper px-1.5 py-0.5 opacity-0 shadow-1 transition-opacity duration-fast focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                  {b.type === "paragraph" ? (
                    <span className="relative">
                      <button
                        type="button"
                        onClick={() => setAlignMenuFor(alignMenuFor === b.id ? null : b.id)}
                        title="محاذاة الفقرة"
                        aria-label="محاذاة الفقرة"
                        aria-expanded={alignMenuFor === b.id}
                        className="flex h-6 w-6 items-center justify-center rounded text-ink-3 hover:bg-surface hover:text-accent"
                      >
                        <AlignIcon align={b.align} />
                      </button>
                      {alignMenuFor === b.id ? (
                        <div className="absolute end-0 top-7 z-20 w-44 overflow-hidden rounded-lg border border-line bg-paper py-1 shadow-2">
                          {ALIGN_OPTIONS.map((opt) => (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => {
                                updateBlock(b.id, { align: opt.key });
                                setAlignMenuFor(null);
                              }}
                              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-[13.5px] hover:bg-surface ${
                                b.align === opt.key ? "font-bold text-brand" : "text-ink"
                              }`}
                            >
                              {opt.label}
                              <AlignIcon align={opt.key} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </span>
                  ) : null}
                  <span onClick={() => moveBlock(b.id, -1)} title="نقل لأعلى" className="cursor-pointer text-xs text-header-muted hover:text-accent">
                    ▲
                  </span>
                  <span onClick={() => moveBlock(b.id, 1)} title="نقل لأسفل" className="cursor-pointer text-xs text-header-muted hover:text-accent">
                    ▼
                  </span>
                  <span onClick={() => removeBlock(b.id)} title="حذف" className="cursor-pointer text-xs text-down">
                    🗑
                  </span>
                </div>
                {b.type === "paragraph" && (
                  <RichTextEditor
                    ref={(h) => {
                      richRefs.current[b.id] = h;
                    }}
                    value={b.text}
                    onChange={(text) => updateBlock(b.id, { text })}
                    placeholder="نص الفقرة"
                    registerField={(el) => {
                      bodyRefs.current[b.id] = el;
                    }}
                    onSplitPaste={(before, lines, after) => pasteAsBlocks(b.id, before, lines, after)}
                    onFocus={() => setActiveBlockId(b.id)}
                    showToolbar={false}
                    bordered={false}
                    minHeightClassName="min-h-[1.9em]"
                  />
                )}
                {b.type === "quote" && (
                  // Styled like the blockquote it becomes on the public page
                  // (rule-accent, italic) — that's what identifies it as a
                  // quote here, not a text label sitting above it.
                  <div className="border-e-2 border-brand ps-3.5 italic text-ink-2">
                    <RichTextEditor
                      ref={(h) => {
                        richRefs.current[b.id] = h;
                      }}
                      value={b.text}
                      onChange={(text) => updateBlock(b.id, { text })}
                      placeholder="نص الاقتباس"
                      registerField={(el) => {
                        bodyRefs.current[b.id] = el;
                      }}
                      onSplitPaste={(before, lines, after) => pasteAsBlocks(b.id, before, lines, after)}
                      onFocus={() => setActiveBlockId(b.id)}
                      showToolbar={false}
                      bordered={false}
                      minHeightClassName="min-h-[1.9em]"
                    />
                  </div>
                )}
                {b.type === "heading" && (
                  // Bold and a size up from body text is what marks this as
                  // a heading here — the same cue the public page's own <h2>
                  // gives it, no separate label needed.
                  <input
                    value={b.text}
                    onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                    onFocus={() => setActiveBlockId(b.id)}
                    placeholder="نص العنوان الفرعي"
                    className="w-full rounded-md border-none bg-transparent p-2.5 text-[19px] font-extrabold text-ink outline-none focus:bg-surface"
                  />
                )}
                {b.type === "image" && (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBlockId(b.id);
                        setPickerFor(b.id);
                      }}
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
                        <span className="absolute inset-x-0 bottom-0 bg-[rgba(6,38,57,.75)] py-1 text-center text-[11.5px] font-bold text-paper opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                          تغيير الصورة
                        </span>
                      ) : null}
                    </button>
                    {/* Upload a new file straight from the device — an
                        alternative to picking an existing library asset, for the
                        common case of a photo that isn't in the library yet. */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveBlockId(b.id);
                        imageFileRefs.current[b.id]?.click();
                      }}
                      title="رفع صورة من الجهاز"
                      className="flex h-[100px] w-[90px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-surface text-[12px] text-header-muted hover:border-accent hover:text-accent"
                    >
                      <span aria-hidden>⬆</span>
                      من الجهاز
                    </button>
                    <input
                      ref={(el) => {
                        imageFileRefs.current[b.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadBlockImage(b.id, f);
                        e.target.value = "";
                      }}
                    />
                    <div className="flex min-w-[180px] flex-1 flex-col gap-2">
                      <input
                        value={b.caption}
                        onChange={(e) => updateBlock(b.id, { caption: e.target.value })}
                        onFocus={() => setActiveBlockId(b.id)}
                        placeholder="التعليق على الصورة"
                        className="rounded-lg border border-line px-2.5 py-2 text-[14px] outline-none focus:border-brand"
                      />
                      <input
                        value={b.credit}
                        onChange={(e) => updateBlock(b.id, { credit: e.target.value })}
                        onFocus={() => setActiveBlockId(b.id)}
                        placeholder="المصدر / الحقوق"
                        className="rounded-lg border border-line px-2.5 py-2 text-[14px] outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                )}
                {b.type === "related" && (
                  <input
                    value={b.text}
                    onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                    onFocus={() => setActiveBlockId(b.id)}
                    placeholder="عنوان المقال المرتبط (اقرأ أيضاً)"
                    className="w-full rounded-lg border border-line p-2.5 text-[15px] outline-none focus:border-brand"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1.5">
          {(Object.keys(BLOCK_LABELS) as Block["type"][]).map((type) => (
            <button key={type} onClick={() => addBlock(type)} className="rounded-pill bg-surface px-4 py-2 text-[13.5px] font-semibold text-ink hover:bg-surface-2">
              + {BLOCK_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">القسم</div>
          <div className="flex flex-wrap gap-1.5">
            {sections.map((s) => (
              <button key={s.key} onClick={() => setSection(s.key)} className={chip(section === s.key)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">الكاتب المسجّل</div>
          <select
            value={authorId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : "";
              setAuthorId(id);
              // Mutually exclusive with the manual byline below: a leftover
              // byline string next to a freshly-linked account is exactly
              // the state that silently hid a linked columnist's photo
              // everywhere except the article page itself (byline used to
              // suppress the avatar too — see get_author_avatar). Picking a
              // real account here is the deliberate choice; it should win
              // outright, not coexist with stale text typed in earlier.
              if (id !== "") setByline("");
            }}
            aria-label="الكاتب المسجّل"
            className="w-full rounded-lg border border-line bg-paper px-2.5 py-2 text-[14px] outline-none focus:border-brand"
          >
            <option value="">بدون — بلا حساب كاتب</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.title ? ` — ${a.title}` : ""}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[12px] leading-relaxed text-ink-3">
            اختر حساباً من «الكتّاب» ليظهر اسمه وصورته وصفته على المقال. يُدار من صفحة الكتّاب.
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">
            اسم الكاتب <span className="font-normal text-ink-3">(اختياري)</span>
          </div>
          <input
            value={byline}
            onChange={(e) => {
              setByline(e.target.value);
              // Same mutual-exclusivity guard, the other direction: typing a
              // manual credit clears whichever registered author was picked
              // above, so the two controls can't drift out of sync again.
              if (e.target.value.trim() && authorId !== "") setAuthorId("");
            }}
            maxLength={120}
            placeholder="اسم الكاتب، أو فريق التحرير…"
            aria-label="اسم الكاتب"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-[14px] outline-none focus:border-brand"
          />
          <div className="mt-2 text-[12px] leading-relaxed text-ink-3">
            يظهر تحت العنوان بدل الكاتب المسجّل أعلاه — اكتب أي اسم بلا حاجة لحساب (فريق التحرير، ضيف…).
          </div>
        </div>
        {coverReplacedByAuthorPhoto ? (
          <div className="rounded-card border border-line bg-paper p-4">
            <div className="mb-2.5 text-[14px] font-bold">صورة الغلاف</div>
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-line bg-surface p-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-brand-tint">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(selectedAuthorAvatar)} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="text-[12.5px] leading-relaxed text-ink-3">
                غير مستخدمة لمقالات الرأي — صورة الكاتب المسجّل أعلاه هي ما يظهر على المقال. لاستخدام غلاف مختلف، أزل الكاتب المسجّل أولاً.
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-line bg-paper p-4">
            <div className="mb-2.5 text-[14px] font-bold">صورة الغلاف</div>
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
                <span className="absolute inset-x-0 bottom-0 bg-[rgba(6,38,57,.75)] py-1.5 text-center text-[12px] font-bold text-paper opacity-0 transition-opacity duration-fast group-hover:opacity-100">
                  تغيير الغلاف
                </span>
              ) : null}
            </button>
            {/* Upload a new file straight from the device — an alternative to
                picking an existing library asset, same as the in-body image
                block already offers. */}
            <button
              type="button"
              onClick={() => coverFileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-surface py-2 text-[13px] font-semibold text-header-muted hover:border-accent hover:text-accent"
            >
              <span aria-hidden>⬆</span> رفع صورة من الجهاز
            </button>
            <input
              ref={coverFileRef}
              type="file"
              accept="image/*"
              aria-label="رفع صورة الغلاف من الجهاز"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCoverImage(f);
                e.target.value = "";
              }}
            />
            <div className="mt-2 text-[12px] leading-relaxed text-ink-3">
              ابحث باسم الصورة أو الشخصية — الصور المرفوعة سابقاً تُعاد بلا رفع جديد وبحقوقها المسجلة.
            </div>
          </div>
        )}
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">الرابط الدائم (Permalink)</div>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            dir="ltr"
            placeholder="يتولّد تلقائياً من العنوان"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-left text-xs outline-none focus:border-brand"
          />
          <div dir="ltr" className="mt-2 truncate text-left text-[12px] text-ink-3">
            /article/{slug.trim() || "…"}
          </div>
          {articleId && initial?.slug && slug.trim() !== initial.slug ? (
            <div className="mt-1.5 text-[12px] font-semibold leading-relaxed text-down">
              تغيير الرابط بعد النشر يكسر أي رابط قديم متداول للخبر.
            </div>
          ) : null}
        </div>
        {/* The red tag on the card grids. Optional — a card with no
            subcategory just falls back to its section name. */}
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">التصنيف الفرعي</div>
          <input
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            maxLength={60}
            placeholder="سياسة / ثقافة وفنون / اقتصاد"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-brand"
          />
          <div className="mt-2 text-[12px] leading-relaxed text-ink-3">يظهر كوسم أحمر فوق عنوان البطاقة في الصفحة الرئيسية.</div>
        </div>
        {/* The country chip on «الخليج» / «عرب وعالم» photos. The datalist
            offers the GCC six because the gulf desk uses the same handful
            daily, but it stays free text — عرب وعالم needs الجزائر, فلسطين,
            and whatever tomorrow's map brings. */}
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">الدولة</div>
          <input
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            maxLength={60}
            list="dn-country-suggestions"
            placeholder="السعودية / الكويت / الجزائر"
            className="w-full rounded-lg border border-line px-2.5 py-2 text-xs outline-none focus:border-brand"
          />
          <datalist id="dn-country-suggestions">
            {["السعودية", "الإمارات", "الكويت", "قطر", "البحرين", "عُمان", "مصر", "فلسطين", "الأردن", "لبنان", "العراق", "سوريا", "اليمن", "ليبيا", "تونس", "الجزائر", "المغرب", "السودان"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <div className="mt-2 text-[12px] leading-relaxed text-ink-3">تظهر كشارة على صورة الخبر في قسمي «الخليج العربي» و«عرب وعالم» فقط.</div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">الوسوم</div>
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
          <div className="mb-2.5 text-[14px] font-bold">النشر والإبراز</div>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[14px] font-semibold text-ink">الظهور في الرئيسية</span>
              <span className="block text-[12px] leading-relaxed text-ink-3">
                يتصدّر شريط الرئيسية الرئيسي وقسمه الخاص، بغض النظر عن وقت النشر.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pushBreaking} onChange={(e) => setPushBreaking(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[14px] font-semibold text-ink">إرسال إلى شريط «عاجل»</span>
              <span className="block text-[12px] leading-relaxed text-ink-3">يظهر العنوان في الشريط الأحمر فور الحفظ والنشر.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input type="checkbox" checked={pushStory} onChange={(e) => setPushStory(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
            <span>
              <span className="block text-[14px] font-semibold text-ink">إضافة إلى «قصص اليوم»</span>
              <span className="block text-[12px] leading-relaxed text-ink-3">ينضم لشريط القصص أعلى الرئيسية بصورة غلافه.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input
              type="checkbox"
              checked={notifyUrgent}
              onChange={(e) => setNotifyUrgent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand"
            />
            <span>
              <span className="block text-[14px] font-semibold text-ink">إشعار عاجل</span>
              <span className="block text-[12px] leading-relaxed text-ink-3">
                مربع عائم يظهر في كل صفحات الموقع لمدة 24 ساعة، ويختفي فوراً إذا نشرت إشعاراً عاجلاً أحدث منه.
              </span>
            </span>
          </label>
          {notifyUrgent && (
            <div className="mt-1.5 ps-6.5">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-ink-3">العنوان الفرعي للإشعار</span>
                <input
                  value={notifyLabel}
                  onChange={(e) => setNotifyLabel(e.target.value)}
                  maxLength={40}
                  placeholder="يحدث الآن"
                  className="w-full rounded-lg border border-line px-2.5 py-1.5 text-[14px] outline-none focus:border-brand"
                />
              </label>
            </div>
          )}
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">الشارة</div>
          <div className="flex flex-wrap gap-1.5">
            {BADGES.map((b) => (
              <button key={b.key} onClick={() => setBadge(b.key)} className={chip(badge === b.key)}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <div className="mb-2.5 text-[14px] font-bold">اللغة</div>
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
          <div className="mb-2.5 text-[14px] font-bold">النسخة الصوتية (TTS)</div>
          {articleId ? (
            <button
              onClick={generateTts}
              disabled={ttsStatus === "generating"}
              className={`w-full rounded-lg py-2.5 text-[14px] font-bold ${
                ttsStatus === "done" ? "bg-up-tint text-up" : ttsStatus === "generating" ? "bg-surface-2 text-ink-3" : "bg-brand text-paper"
              }`}
            >
              {ttsStatus === "idle" && "🎙 توليد النسخة الصوتية"}
              {ttsStatus === "generating" && "جارِ التوليد..."}
              {ttsStatus === "done" && `✓ تم التوليد — ${Math.floor(ttsDuration / 60)}:${String(ttsDuration % 60).padStart(2, "0")}`}
            </button>
          ) : (
            <p className="m-0 text-[13px] text-ink-3">احفظ المقال أولاً — التوليد يحتاج النص كما هو محفوظ على الخادم.</p>
          )}
        </div>
        <div className="flex items-center gap-2.5 rounded-card border border-line bg-brand-tint p-4">
          <span className="text-[20px]">◔</span>
          <div>
            <div className="text-[15px] font-extrabold text-brand-strong">{readMinutes} دقائق قراءة</div>
            <div className="text-[12px] text-brand-strong">يُحسب تلقائياً (كلمات ÷ 200)</div>
          </div>
        </div>
        <div className="rounded-card border border-line bg-paper p-4">
          <label htmlFor="schedule-at" className="mb-1.5 block text-[13px] font-bold text-ink-3">
            جدولة النشر (اختياري)
          </label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-brand"
          />
          {scheduledFor ? (
            <button
              onClick={() => save("scheduled")}
              disabled={saving}
              className="mt-2.5 w-full rounded-lg bg-accent py-2.5 text-[14px] font-bold text-paper hover:bg-accent-strong disabled:opacity-60"
            >
              ⏰ جدولة النشر
            </button>
          ) : (
            <p className="m-0 mt-1.5 text-[12px] leading-relaxed text-ink-3">
              اختر وقتاً وسيُنشر الخبر تلقائياً في موعده — تتحقق اللوحة من المواعيد كل دقيقة.
            </p>
          )}
        </div>

        <div className="flex gap-2.5">
          <button onClick={() => save("draft")} disabled={saving} className="flex-1 rounded-lg border border-line-strong bg-paper py-2.5 text-[14px] font-bold text-ink disabled:opacity-60">
            حفظ كأرشفة
          </button>
          <button
            onClick={() => save("review")}
            disabled={saving}
            title="يظهر الخبر في طابور المراجعة بالنظرة العامة حتى يراجعه أحد فريق التحرير وينشره"
            className="flex-1 rounded-lg border border-brand bg-paper py-2.5 text-[14px] font-bold text-brand hover:bg-brand-tint disabled:opacity-60"
          >
            إرسال للمراجعة
          </button>
          <button onClick={() => save("published")} disabled={saving} className="flex-1 rounded-lg bg-brand py-2.5 text-[14px] font-bold text-paper hover:bg-brand-strong disabled:opacity-60">
            حفظ ونشر
          </button>
        </div>
      </div>

      {pickerFor !== null ? <MediaLibraryPicker onPick={pickAsset} onClose={() => setPickerFor(null)} /> : null}
    </div>
    </>
  );
}
