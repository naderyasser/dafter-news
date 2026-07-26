import { IBM_Plex_Sans_Arabic, Inter, Noto_Kufi_Arabic } from "next/font/google";

// Arabic display face — the brief's §1 "signature" surfaces (logo, section
// headings, article H2, quotes, sidebar boxes, footer headings) and §3
// type rules: عربي عناوين Noto Kufi Arabic (700–800) · جسم IBM Plex Sans
// Arabic (400–600). Inter serves both roles for English pages (§4).
export const notoKufiArabic = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  weight: ["700", "800"],
  variable: "--font-kufi",
  display: "swap",
});

export const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
