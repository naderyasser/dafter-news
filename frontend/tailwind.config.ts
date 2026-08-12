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
        // The blue half of the identity, sampled straight out of the brand
        // mark (media/branding/aldaftar-masr.png): the wordmark is #073252 and
        // the pen nib is #C4202B, so the site was carrying only half its own
        // logo. `strong` IS the logo blue; DEFAULT is one step up so a headline
        // still reads as blue rather than as near-black, and `soft` is the
        // on-dark variant. Red is now reserved for urgency (عاجل / مباشر /
        // alerts) and blue carries the everyday accents.
        accent: { DEFAULT: "#0E4B7B", strong: "#073252", soft: "#2A6BA8", tint: "#EAF1F8" },
        // Navy carries the dark surfaces (header, hero, footer, dark section
        // bands) while the brand red stays the accent — the client asked for
        // navy "كخلفية أو عنصر بارز" while preserving the visual identity.
        // Retuned onto the mark's hue: the old #101B33 was a violet-leaning
        // navy that sat visibly beside the logo's #073252 rather than under it.
        navy: { DEFAULT: "#0B3454", strong: "#062639", 2: "#164A70", tint: "#E7EFF6" },
        ink: { DEFAULT: "#171A1F", 2: "#3C434C", 3: "#6A727C" },
        // The two fronts that are dark all the way down: «علوم وتكنولوجيا»
        // reads as a drafting board, «لقطة وتعليق» as a darkened room. Tokens
        // rather than inline hex so the focus-ring rule in globals.css can name
        // the surfaces — a keyboard reader on either page was otherwise getting
        // the default blue ring against near-black.
        board: { DEFAULT: "#101820", stage: "#0A0A0B" },
        paper: "#FFFFFF",
        surface: { DEFAULT: "#F4F5F7", 2: "#EBEDF0" },
        line: { DEFAULT: "#E2E5E9", strong: "#C9CED4" },
        // bg was a neutral near-black; it is the logo blue now so the topbar
        // and footer read as the same object as the mark between them.
        header: { bg: "#072D4A", ink: "#F5F6F7", muted: "#9FB3C6" },
        badge: { breaking: "#D71F30", live: "#D71F30", exclusive: "#A97E14", video: "#171A1F" },
        // `dark` is the on-dark step of each, for the market desk's price
        // board. The paper-tuned values are unreadable there — #0E8A4C lands
        // at 3.54:1 on navy-strong and #C93030 at 2.94:1, both under the 4.5
        // floor for what is the most number-dense surface on the site. These
        // clear 6.6:1 and 5.5:1. Direction is never carried by the colour
        // alone in either mode: every figure ships with a ▲/▼ and a signed
        // percentage, so a red/green pair stays legible to a CVD reader.
        up: { DEFAULT: "#0E8A4C", tint: "#E7F4ED", dark: "#3FBF7F" },
        down: { DEFAULT: "#C93030", tint: "#FBEDED", dark: "#F0736B" },
        gold: { DEFAULT: "#A97E14", dark: "#E0B54A" },
      },
      fontFamily: {
        "display-ar": ["var(--font-kufi)", "var(--font-plex-arabic)", "system-ui", "sans-serif"],
        "body-ar": ["var(--font-plex-arabic)", "Segoe UI", "Tahoma", "system-ui", "sans-serif"],
        "display-en": ["var(--font-inter)", "system-ui", "sans-serif"],
        "body-en": ["var(--font-inter)", "system-ui", "sans-serif"],
        // The dashboard's own face — see lib/fonts.ts's `cairo` for why.
        "dashboard-ar": ["var(--font-cairo)", "Segoe UI", "Tahoma", "system-ui", "sans-serif"],
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
        // The corner alert slides up from below its resting place and fades,
        // so it reads as arriving rather than as having been there all along.
        // translateY only — a slide along the inline axis would need two
        // keyframe sets to mirror in RTL.
        // The drawer opens from the inline-start edge, which is the right in
        // RTL and the left in LTR — two keyframes rather than one, because a
        // single translateX cannot express "from whichever edge this is".
        "drawer-in-rtl": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "drawer-in-ltr": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "toast-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(16px)" },
        },
        // Story timer. Animated rather than driven by a React state tick so
        // the bar stays smooth without re-rendering the card every frame, and
        // so pausing is a single [animation-play-state] toggle. It fills from
        // the inline start, which reverses for free in RTL.
        "story-fill": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
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
        "drawer-in-rtl": "drawer-in-rtl 240ms cubic-bezier(.16,1,.3,1) both",
        "drawer-in-ltr": "drawer-in-ltr 240ms cubic-bezier(.16,1,.3,1) both",
        "toast-in": "toast-in 260ms cubic-bezier(.16,1,.3,1) both",
        "toast-out": "toast-out 200ms ease both",
        // Duration is overridden per-instance so one constant in the story
        // components controls both the timer and the advance interval.
        // `both`, not `forwards`: the empty `from` state has to apply before
        // the first frame too, or a freshly-mounted bar flashes full for a
        // frame and the timer looks like it ran backwards.
        "story-fill": "story-fill 5s linear both",
      },
    },
  },
  plugins: [],
};

export default config;
