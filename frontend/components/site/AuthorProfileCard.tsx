import Link from "next/link";

import { mediaUrl } from "@/lib/api";
import type { Author } from "@/lib/types";

/**
 * The journalist's face, name and one-line bio in a bordered card — the
 * credibility block. Opinion pages have always led with it; «ملف خاص»
 * investigations now carry the same card under the headline, because a
 * six-month investigation is signed work the same way a column is.
 */
export default function AuthorProfileCard({ lang, author }: { lang: "ar" | "en"; author: Author }) {
  const name = (lang === "en" && author.name_en) || author.name;
  return (
    <Link
      href={`/authors/${author.username}`}
      className="mb-5 flex items-center gap-3 rounded-card border border-line bg-paper p-3.5 no-underline"
    >
      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-brand-tint">
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(author.avatar) ?? undefined} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[22px] font-extrabold text-brand">{author.initial}</span>
        )}
      </div>
      <div>
        <div className="text-[15px] font-bold text-ink">{name}</div>
        <div className="mt-0.5 text-[13px] text-ink-3">{author.title || (author.bio ?? "")}</div>
      </div>
    </Link>
  );
}
