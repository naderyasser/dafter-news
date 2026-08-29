import Link from "next/link";

/**
 * «بالعقل والمنطق»'s one identity card — white ground, a red opening
 * quotation mark, the writer's own words as the headline, and the writer
 * themselves (portrait or initial) below. Shared so the desk looks like
 * itself wherever it's shown: the dedicated /opinion page, and the section
 * front at /section/opinion — see OpinionFront's docstring for why the
 * section front stopped using its own portrait-lead layout for this.
 */
export type OpinionCardProps = {
  lang: "ar" | "en";
  href: string;
  quote: string;
  authorName?: string;
  authorInitial?: string;
  authorAvatar?: string;
  /** Omitted everywhere this card is used — see the homepage carousel's
   *  own opinionItems, which never set a time either. Left optional rather
   *  than deleted so a caller with a real reason to date-stamp a column
   *  still can. */
  time?: string;
};

export default function OpinionCard({ lang, href, quote, authorName, authorInitial, authorAvatar, time }: OpinionCardProps) {
  const isAr = lang === "ar";
  const fontDisplay = isAr ? "font-display-ar" : "font-display-en";

  return (
    <Link
      href={href}
      className="flex flex-col gap-3.5 rounded-card border border-line bg-paper p-5.5 no-underline transition-colors duration-fast hover:border-brand"
    >
      <span aria-hidden className="font-serif text-[36px] font-extrabold leading-[.6] text-brand">
        &ldquo;
      </span>
      <div className={`${fontDisplay} flex-1 text-[16px] font-bold leading-[1.6] text-ink`}>{quote}</div>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand bg-brand-tint text-[15px] font-extrabold text-brand">
          {authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={authorAvatar} alt={authorName || ""} className="h-full w-full object-cover" />
          ) : (
            authorInitial || "؟"
          )}
        </span>
        {authorName && <span className="text-[13px] font-semibold text-ink-2">{authorName}</span>}
        {time && <span className="tnum ms-auto text-xs text-ink-3">{time}</span>}
      </div>
    </Link>
  );
}
