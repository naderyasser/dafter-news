import Link from "next/link";

import { mediaUrl } from "@/lib/api";
import type { Author } from "@/lib/types";

/**
 * The journalist's face, name and one-line bio — the credibility block.
 * Opinion pages have always led with it; «ملف خاص» investigations now carry
 * the same card under the headline, because a six-month investigation is
 * signed work the same way a column is.
 *
 * `feature`, used only by the opinion single-post view (client's own
 * reference screenshot: name large and bold, title lighter and smaller
 * directly under it, portrait bigger and unmistakably the focal point) skips
 * the bordered-card treatment entirely — it's a byline block sitting in the
 * page flow, not a card floating on top of it.
 */
export default function AuthorProfileCard({ lang, author, feature = false }: { lang: "ar" | "en"; author: Author; feature?: boolean }) {
  const name = (lang === "en" && author.name_en) || author.name;
  const fontDisplay = lang === "en" ? "font-display-en" : "font-display-ar";
  const avatarSize = feature ? "h-24 w-24" : "h-16 w-16";

  return (
    <Link
      href={`/authors/${author.username}`}
      className={feature ? "mb-5 flex items-center gap-4 no-underline" : "mb-5 flex items-center gap-3 rounded-card border border-line bg-paper p-3.5 no-underline"}
    >
      <div className={`flex ${avatarSize} flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-brand-tint`}>
        {author.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(author.avatar) ?? undefined} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className={feature ? "text-[34px] font-extrabold text-brand" : "text-[22px] font-extrabold text-brand"}>{author.initial}</span>
        )}
      </div>
      <div>
        <div className={feature ? `${fontDisplay} text-[24px] font-extrabold leading-tight text-ink` : "text-[15px] font-bold text-ink"}>{name}</div>
        <div className={feature ? "mt-1.5 text-[16px] font-normal text-ink-3" : "mt-0.5 text-[13px] text-ink-3"}>{author.title || (author.bio ?? "")}</div>
      </div>
    </Link>
  );
}
