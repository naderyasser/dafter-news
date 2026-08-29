import Link from "next/link";

/**
 * «المزيد ←» — the full-width outlined button at the foot of every section
 * block, matching the client's reference.
 *
 * It replaces the small "عرض الكل" link that used to sit in the block's top
 * corner. Two reasons it moved: a reader who wants more of a desk wants it
 * AFTER reading what the block offered, not before; and at the top it sat in
 * the same corner as the nameplate, so the two competed.
 *
 * The arrow points to the inline END — left in Arabic, right in English —
 * which is "onward" in both. `rtl:` / `ltr:` rather than a mirrored glyph so
 * the same character is used in both editions.
 */
export default function SectionMore({
  lang,
  href,
  label,
  tone = "light",
}: {
  lang: "ar" | "en";
  href: string;
  /** Defaults to «المزيد» / "More". */
  label?: string;
  tone?: "light" | "dark";
}) {
  const isAr = lang === "ar";
  const onDark = tone === "dark";

  return (
    <div className="mt-6">
      <Link
        href={href}
        className={`flex w-full items-center justify-center gap-2 rounded-pill border px-5 py-2.5 text-[14.5px] font-bold no-underline transition-colors duration-fast ${
          onDark
            ? "border-white/25 text-paper hover:border-paper hover:bg-white/10"
            : "border-line text-ink hover:border-brand hover:bg-brand hover:text-paper"
        }`}
      >
        {label ?? (isAr ? "المزيد" : "More")}
        <span aria-hidden className="text-[15px] leading-none rtl:rotate-0 ltr:rotate-180">
          ←
        </span>
      </Link>
    </div>
  );
}
