import type { Config } from "tailwindcss";

/**
 * Design tokens transcribed 1:1 from the Claude Design brief (§2 Design
 * Tokens) — chats/chat1.md. This file is the single source of truth for
 * color/type/spacing/radius across the app; components must reference
 * these tokens (bg-brand, text-ink-3, rounded-card, ...) and never inline
 * raw hex, per brief §10.1 "hex خام في المكونات — التوكنز فقط".
 */
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#B01F2E", strong: "#8E1624", tint: "#FBEEEF" },
        // Navy carries the dark surfaces (header, hero, footer, dark section
        // bands) while the brand red stays the accent — the client asked for
        // navy "كخلفية أو عنصر بارز" while preserving the visual identity.
        navy: { DEFAULT: "#101B33", strong: "#0A1224", 2: "#1B2A47", tint: "#E8ECF4" },
        ink: { DEFAULT: "#171A1F", 2: "#3C434C", 3: "#6A727C" },
        paper: "#FFFFFF",
        surface: { DEFAULT: "#F4F5F7", 2: "#EBEDF0" },
        line: { DEFAULT: "#E2E5E9", strong: "#C9CED4" },
        header: { bg: "#14171C", ink: "#F5F6F7", muted: "#9AA1AA" },
        badge: { breaking: "#D71F30", live: "#D71F30", exclusive: "#A97E14", video: "#171A1F" },
        up: { DEFAULT: "#0E8A4C", tint: "#E7F4ED" },
        down: { DEFAULT: "#C93030", tint: "#FBEDED" },
        gold: { DEFAULT: "#A97E14" },
      },
      fontFamily: {
        "display-ar": ["var(--font-kufi)", "var(--font-plex-arabic)", "system-ui", "sans-serif"],
        "body-ar": ["var(--font-plex-arabic)", "Segoe UI", "Tahoma", "system-ui", "sans-serif"],
        "display-en": ["var(--font-inter)", "system-ui", "sans-serif"],
        "body-en": ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        hero: ["2.125rem", { lineHeight: "1.4" }],
        h1: ["1.75rem", { lineHeight: "1.5" }],
        h2: ["1.375rem", { lineHeight: "1.5" }],
        h3: ["1.125rem", { lineHeight: "1.5" }],
        "card-sm": ["0.9375rem", { lineHeight: "1.5" }],
        body: ["1.1875rem", { lineHeight: "1.95" }],
        ui: ["0.875rem", { lineHeight: "1.4" }],
        caption: ["0.8125rem", { lineHeight: "1.4" }],
      },
      maxWidth: {
        container: "1200px",
        reading: "680px",
      },
      borderRadius: {
        DEFAULT: "6px",
        card: "6px",
        badge: "4px",
        pill: "999px",
      },
      boxShadow: {
        1: "0 1px 2px rgba(23,26,31,.06)",
        2: "0 4px 14px rgba(23,26,31,.10)",
        sticky: "0 -2px 12px rgba(23,26,31,.12)",
      },
      transitionDuration: {
        fast: "120ms",
        med: "220ms",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".35", transform: "scale(1.35)" },
        },
        "marquee-rtl": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(50%)" },
        },
        "marquee-ltr": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        skeleton: {
          "0%, 100%": { opacity: ".6" },
          "50%": { opacity: "1" },
        },
        // Slower, continuous travel for the markets tape — it runs all the
        // time, so it reads as ambient rather than as an alert like «عاجل».
        "ticker-rtl": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(50%)" },
        },
        "ticker-ltr": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "marquee-rtl": "marquee-rtl 32s linear infinite",
        "marquee-ltr": "marquee-ltr 32s linear infinite",
        "ticker-rtl": "ticker-rtl 48s linear infinite",
        "ticker-ltr": "ticker-ltr 48s linear infinite",
        skeleton: "skeleton 1.4s ease-in-out infinite",
        "fade-in": "fade-in 220ms ease both",
        "modal-in": "modal-in 220ms ease both",
      },
    },
  },
  plugins: [],
};

export default config;
