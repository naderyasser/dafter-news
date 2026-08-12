import { Cairo, IBM_Plex_Sans_Arabic, Inter, Noto_Kufi_Arabic } from "next/font/google";

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

// Dashboard-only face — the client asked for the admin console to read
// clearer and bigger, closer to a newsroom console like Sky News Arabia's or
// Al Hadath's than to the public site's editorial serif-adjacent body face.
// Cairo is a geometric, upright Arabic UI grotesk built for screens at small
// sizes (unlike IBM Plex Sans Arabic, tuned for long-form reading), which is
// what those two sites' own dashboards read as. Scoped to font-dashboard-ar
// only — the public site keeps its existing type entirely.
export const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});
