import type { Metadata } from "next";
import { headers } from "next/headers";

import { ibmPlexSansArabic, inter, notoKufiArabic } from "@/lib/fonts";

import "./globals.css";

// Title and description follow the same x-locale header the <html> tag reads
// below. As a static export they were Arabic on every route, which put an
// Arabic <title> on the English edition's tab and in its search snippet.
export function generateMetadata(): Metadata {
  const isEn = headers().get("x-locale") === "en";
  return isEn
    ? {
        title: "Al Daftar News — aldaftarnews.com",
        description: "Arabic news from Egypt and the region: politics, economy, sport and opinion.",
      }
    : {
        title: "الدفتر نيوز — aldaftarnews.com",
        description: "موقع إخباري عربي يغطي مصر والمنطقة: سياسة، اقتصاد، رياضة، ورأي.",
      };
}

// The site is bilingual (AR RTL default / EN LTR — brief §4). App Router
// root layouts are shared across every route, so dir/lang/font-family are
// ALSO set on each page's own wrapper div (exactly like the source's
// `<div dir="ltr" lang="en" ...>`) for logical properties to resolve
// correctly. The outer <html lang dir> below still needs to be correct for
// real users (screen readers, browser translate, search engines read
// <html lang> as authoritative) — middleware.ts tags each request with the
// locale implied by its URL so it isn't hardcoded to Arabic on /en/*.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = headers().get("x-locale") === "en" ? "en" : "ar";
  return (
    <html
      lang={locale}
      dir={locale === "en" ? "ltr" : "rtl"}
      className={`${notoKufiArabic.variable} ${ibmPlexSansArabic.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
