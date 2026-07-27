"use client";

import { useRef, useState } from "react";

import StatusBadge from "@/components/dashboard/StatusBadge";
import { dashMutate, dashUpload, mediaUrl } from "@/lib/api";
import { formatDate, toEasternNumerals } from "@/lib/format";
import type { ArticleCard, ArticleStatus, Author } from "@/lib/types";

const input = "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13px] outline-none focus:border-brand";

/** The two states the panel can flip an opinion piece between. */
const STATUS_OPTIONS: { key: ArticleStatus; label: string }[] = [
  { key: "published", label: "منشور" },
  { key: "draft", label: "مسودة" },
];

type Draft = { username: string; first_name: string; last_name: string; title: string; bio: string };

const EMPTY: Draft = { username: "", first_name: "", last_name: "", title: "", bio: "" };

export default function ColumnistsManager({
  authors: initialAuthors,
  articles: initialArticles,
}: {
  authors: Author[];
  articles: ArticleCard[];
}) {
  const [authors, setAuthors] = useState(initialAuthors);
  const [articles, setArticles] = useState(initialArticles);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [error, setError] = useState("");

  const patchAuthor = async (author: Author, body: Partial<Author>) => {
    setError("");
    const before = authors;
    setAuthors((as) => as.map((a) => (a.id === author.id ? { ...a, ...body } : a)));
    try {
      const saved = await dashMutate<Author>(`/authors/${author.username}/`, "PATCH", body);
      setAuthors((as) => as.map((a) => (a.id === saved.id ? saved : a)));
    } catch {
      setAuthors(before);
      setError("تعذّر حفظ بيانات الكاتب.");
    }
  };

  const removeAuthor = async (author: Author) => {
    if (!confirm(`حذف «${author.name}» نهائياً؟ مقالاته ستبقى بدون كاتب.`)) return;
    setError("");
    const before = authors;
    setAuthors((as) => as.filter((a) => a.id !== author.id));
    try {
      await dashMutate(`/authors/${author.username}/`, "DELETE");
    } catch {
      setAuthors(before);
      setError("تعذّر حذف الكاتب.");
    }
  };

  const setStatus = async (article: ArticleCard, status: ArticleStatus) => {
    setError("");
    const before = articles;
    setArticles((as) => as.map((a) => (a.id === article.id ? { ...a, status } : a)));
    try {
      await dashMutate(`/articles/${article.id}/`, "PATCH", { status });
    } catch {
      setArticles(before);
      setError("تعذّر تغيير حالة المقال.");
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
          <span className="text-[15px] font-bold">الكتّاب</span>
          <button
            onClick={() => setAdding(true)}
            className="rounded-pill bg-surface px-4 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-surface-2"
          >
            + كاتب جديد
          </button>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
          {authors.map((a) => (
            <AuthorCard
              key={a.id}
              author={a}
              onEdit={() => setEditing(a)}
              onToggleHidden={() => patchAuthor(a, { is_hidden: !a.is_hidden })}
              onDelete={() => removeAuthor(a)}
            />
          ))}
          {authors.length === 0 && (
            <div className="col-span-full p-8 text-center text-ui text-ink-3">لا يوجد كتّاب بعد</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 text-[15px] font-bold">مقالات الرأي</div>
        <div className="overflow-hidden rounded-card border border-line bg-paper">
          <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr] bg-surface">
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">العنوان</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الكاتب</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">الحالة</div>
            <div className="px-3.5 py-2.5 text-xs font-bold text-ink-3">التاريخ</div>
          </div>
          {articles.map((o) => (
            <div key={o.id} className="grid min-h-[48px] grid-cols-[2.4fr_1fr_1fr_1fr] items-center border-t border-line">
              <div className="px-3.5 py-2 text-[13.5px] font-semibold text-ink">{o.title}</div>
              <div className="px-3.5 text-[13.5px] text-ink-3">{o.author_name || "—"}</div>
              <div className="flex items-center gap-2 px-3.5 py-2">
                <StatusBadge status={o.status} />
                {/* Only offers the two states the brief asks for; anything in
                    review/scheduled/rejected still shows its real badge above
                    and can be moved to either from here. */}
                <select
                  value={STATUS_OPTIONS.some((s) => s.key === o.status) ? o.status : ""}
                  onChange={(e) => setStatus(o, e.target.value as ArticleStatus)}
                  aria-label={`تغيير حالة: ${o.title}`}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-[11.5px] outline-none focus:border-brand"
                >
                  <option value="" disabled>
                    تغيير…
                  </option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-3.5 text-[13.5px] text-ink-3">{formatDate(o.published_at, "ar") || "—"}</div>
            </div>
          ))}
          {articles.length === 0 && <div className="p-8 text-center text-ui text-ink-3">لا توجد مقالات رأي</div>}
        </div>
      </div>

      {adding && (
        <AuthorDialog
          title="كاتب جديد"
          onCancel={() => setAdding(false)}
          onSave={async (draft, avatar) => {
            setError("");
            try {
              const created = await dashMutate<Author>("/authors/", "POST", draft);
              const withPhoto = avatar ? await uploadAvatar(created.username, avatar) : created;
              setAuthors((as) => [...as, withPhoto]);
              setAdding(false);
            } catch {
              setError("تعذّر إضافة الكاتب — تأكد أن اسم المستخدم غير مكرر.");
            }
          }}
        />
      )}

      {editing && (
        <AuthorDialog
          title="تعديل الكاتب"
          author={editing}
          onCancel={() => setEditing(null)}
          onSave={async (draft, avatar) => {
            setError("");
            const target = editing;
            setEditing(null);
            try {
              const saved = await dashMutate<Author>(`/authors/${target.username}/`, "PATCH", draft);
              const withPhoto = avatar ? await uploadAvatar(saved.username, avatar) : saved;
              setAuthors((as) => as.map((a) => (a.id === withPhoto.id ? withPhoto : a)));
            } catch {
              setError("تعذّر حفظ بيانات الكاتب.");
            }
          }}
        />
      )}
    </>
  );
}

async function uploadAvatar(username: string, file: File): Promise<Author> {
  const form = new FormData();
  form.append("avatar", file);
  return dashUpload<Author>(`/authors/${username}/`, "PATCH", form);
}

function AuthorCard({
  author,
  onEdit,
  onToggleHidden,
  onDelete,
}: {
  author: Author;
  onEdit: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-card border border-line bg-paper p-4 text-center ${
        author.is_hidden ? "opacity-60" : ""
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-brand-tint text-[18px] font-extrabold text-brand">
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(author.avatar)} alt={author.name} className="h-full w-full object-cover" />
        ) : (
          author.initial
        )}
      </div>
      <span className="text-[13.5px] font-bold">{author.name}</span>
      {author.title && <span className="text-[11px] text-ink-3">{author.title}</span>}
      {/* Counted server-side from the article table, so it can't drift. */}
      <span className="text-[11.5px] text-ink-3">{toEasternNumerals(author.opinion_count)} مقال رأي</span>
      {author.is_hidden && (
        <span className="rounded-badge bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-ink-3">مخفي من الموقع</span>
      )}
      <div className="mt-1 flex flex-wrap justify-center gap-3 text-[11.5px]">
        <button onClick={onEdit} className="font-bold text-brand hover:underline">
          تعديل
        </button>
        <button onClick={onToggleHidden} className="font-bold text-ink-3 hover:underline">
          {author.is_hidden ? "إظهار" : "إخفاء"}
        </button>
        <button onClick={onDelete} className="font-bold text-down hover:underline">
          مسح
        </button>
      </div>
    </div>
  );
}

function AuthorDialog({
  title,
  author,
  onCancel,
  onSave,
}: {
  title: string;
  author?: Author;
  onCancel: () => void;
  onSave: (draft: Draft, avatar: File | null) => void;
}) {
  // `name` is derived server-side from first + last, so renaming means editing
  // those two rather than the display string.
  const [first, ...restName] = (author?.name ?? "").split(" ");
  const [draft, setDraft] = useState<Draft>(
    author
      ? {
          username: author.username,
          first_name: first ?? "",
          last_name: restName.join(" "),
          title: author.title,
          bio: author.bio,
        }
      : EMPTY,
  );
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(mediaUrl(author?.avatar));
  const fileRef = useRef<HTMLInputElement>(null);
  const isNew = !author;

  const usernameValid = !isNew || /^[\w.@+-]{3,}$/.test(draft.username);
  const canSave = draft.first_name.trim().length > 0 && usernameValid;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(10,11,13,.55)] p-4" onClick={onCancel} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in max-h-full w-full max-w-[460px] overflow-y-auto rounded-card bg-paper p-5 shadow-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-extrabold">{title}</span>
          <button onClick={onCancel} aria-label="إغلاق" className="text-[18px] leading-none text-ink-3 hover:text-ink">
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="اختر صورة الكاتب"
            className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-line-strong bg-surface text-[10.5px] text-ink-3 hover:border-brand hover:text-brand"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              "صورة"
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setAvatar(f);
                setPreview(URL.createObjectURL(f));
              }
              e.target.value = "";
            }}
          />
          <span className="text-[12px] text-ink-3">اضغط الدائرة لاختيار صورة الكاتب</span>
        </div>

        <div className="flex flex-col gap-3">
          {isNew && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold text-ink-3">اسم المستخدم</span>
              <input
                value={draft.username}
                onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                placeholder="a.labib"
                className={input}
              />
              {!usernameValid && draft.username.length > 0 && (
                <span className="text-[11px] text-down">3 أحرف على الأقل، إنجليزية وأرقام ونقاط فقط.</span>
              )}
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">الاسم الأول</span>
            <input value={draft.first_name} onChange={(e) => setDraft({ ...draft, first_name: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">اسم العائلة</span>
            <input value={draft.last_name} onChange={(e) => setDraft({ ...draft, last_name: e.target.value })} className={input} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">الصفة</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="كاتبة اقتصادية"
              className={input}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-ink-3">نبذة</span>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              className={`${input} min-h-[70px] resize-y`}
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink hover:bg-surface">
            إلغاء
          </button>
          <button
            onClick={() => onSave(draft, avatar)}
            disabled={!canSave}
            className="rounded-lg bg-brand px-4.5 py-2 text-[13px] font-bold text-paper hover:bg-brand-strong disabled:opacity-50"
          >
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
