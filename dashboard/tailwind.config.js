/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lumen · Night Foundry — channels come from --tw-* in tokens.css so a
        // scope (e.g. the Gaming Edition themes) can re-skin them; alpha
        // modifiers like bg-brass/10 still compile
        paper: "oklch(var(--tw-paper) / <alpha-value>)",
        paper2: "oklch(var(--tw-paper2) / <alpha-value>)",
        paper3: "oklch(var(--tw-paper3) / <alpha-value>)",
        ink: "oklch(var(--tw-ink) / <alpha-value>)",
        ink2: "oklch(var(--tw-ink2) / <alpha-value>)",
        muted: "oklch(var(--tw-muted) / <alpha-value>)",
        brass: "oklch(var(--tw-brass) / <alpha-value>)",
        brassink: "oklch(var(--tw-brassink) / <alpha-value>)",
        coral: "oklch(var(--tw-coral) / <alpha-value>)",
        ok: "oklch(var(--tw-ok) / <alpha-value>)",
        warn: "oklch(var(--tw-warn) / <alpha-value>)",
        danger: "oklch(var(--tw-danger) / <alpha-value>)",
        // legacy aliases so untouched files degrade gracefully
        background: "oklch(var(--tw-paper) / <alpha-value>)",
        surface: "oklch(var(--tw-paper2) / <alpha-value>)",
        primary: "oklch(var(--tw-brass) / <alpha-value>)",
        accent: "oklch(var(--tw-coral) / <alpha-value>)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        sans: "var(--font-body)",
        serif: "var(--font-display)",
        mono: "var(--font-mono)",
      },
      borderColor: {
        rule: "var(--color-rule)",
        rule2: "var(--color-rule-2)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        input: "var(--radius-input)",
      },
      fontSize: {
        micro: ["10.5px", { letterSpacing: "0.10em" }],
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade': 'fadeIn 0.4s var(--ease-out)',
        // mobile shell: the nav drawer flies in from the edge, sheets rise
        'slide-in-left': 'slideInLeft 0.24s var(--ease-out)',
        'sheet-up': 'sheetUp 0.26s var(--ease-out)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        sheetUp: {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
