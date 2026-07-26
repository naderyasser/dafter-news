"use client";

import { useRouter } from "next/navigation";

export default function SearchBox({ lang }: { lang: "ar" | "en" }) {
  const router = useRouter();
  const isAr = lang === "ar";
  return (
    <div className="relative max-w-[460px] flex-1 basis-60">
      <a
        href="/search"
        className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-3 no-underline"
        aria-label={isAr ? "بحث" : "Search"}
      >
        🔍
      </a>
      <input
        type="text"
        placeholder={isAr ? "ابحث في الدفتر نيوز..." : "Search Al Daftar News..."}
        onKeyDown={(e) => {
          if (e.key === "Enter") router.push("/search");
        }}
        className="w-full rounded-pill border border-line bg-surface py-2.5 pe-4 ps-9 text-[14px] text-ink outline-none focus:border-brand focus:bg-paper"
      />
    </div>
  );
}
