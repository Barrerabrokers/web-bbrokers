/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Geist", "Switzer", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "Cormorant Garamond", "Voyage", "ui-serif", "Georgia", "serif"],
        display: ["var(--font-display)", "Cormorant Garamond", "Voyage", "ui-serif", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        // ========================================================
        // PALETA MONOCROMÁTICA — Obsidian Assembly quiet luxury
        // Solo dos colores: ink (#151415) + bone (#F1EADE)
        // El resto son escalas tonales entre ellos
        // ========================================================
        ink: {
          DEFAULT: "#151415",
          50: "#f1eade",
          100: "#cfc7b8",
          200: "#a89e8e",
          300: "#7d7468",
          400: "#5a5247",
          500: "#3a342f",
          600: "#252220",
          700: "#1c1a1a",
          800: "#181718",
          900: "#151415",
        },
        bone: {
          DEFAULT: "#F1EADE",
          50: "#faf6ee",
          100: "#F1EADE",
          200: "#e3dac9",
          300: "#cfc7b5",
          400: "#a39c8e",
          500: "#736d63",
        },
        // accent DEFAULT = bone para que `bg-accent` quede ivory-on-dark
        // accent-700 = ink para `text-accent-700` sobre fondos claros
        accent: {
          DEFAULT: "#F1EADE",
          50: "#faf6ee",
          100: "#F1EADE",
          200: "#e3dac9",
          300: "#cfc7b5",
          400: "#a39c8e",
          500: "#3a342f",
          600: "#252220",
          700: "#151415",
          800: "#151415",
          900: "#151415",
        },
        // Aliases legacy mapeados al monocromo
        gray: {
          50: "#faf6ee", 100: "#F1EADE", 200: "#e3dac9", 300: "#cfc7b5",
          400: "#a39c8e", 500: "#736d63", 600: "#3a342f", 700: "#252220",
          750: "#1f1d1d", 800: "#1c1a1a", 850: "#181718", 900: "#151415", 950: "#0e0d0e",
        },
        charcoal: {
          50: "#F1EADE", 100: "#e3dac9", 200: "#cfc7b5", 300: "#a39c8e",
          400: "#736d63", 500: "#3a342f", 600: "#252220", 700: "#1c1a1a",
          800: "#181718", 900: "#151415",
        },
        cream: {
          50: "#faf6ee", 100: "#F1EADE", 200: "#e3dac9", 300: "#cfc7b5",
          400: "#a39c8e", 500: "#736d63", 600: "#3a342f", 700: "#252220",
          800: "#1c1a1a", 900: "#181718", 950: "#151415",
        },
        bronze: { DEFAULT: "#151415" },
        stone: { DEFAULT: "#a39c8e" },
        olive: { DEFAULT: "#3a342f" },
        gold: { DEFAULT: "#151415" },
        brown: { DEFAULT: "#151415" },
      },
      letterSpacing: {
        tightest: "-0.04em", tighter: "-0.02em", tight: "-0.01em",
        wide: "0.02em", wider: "0.06em", widest: "0.18em",
      },
      fontSize: {
        "display-xs": ["3rem", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-sm": ["4rem", { lineHeight: "1.02", letterSpacing: "-0.025em" }],
        "display-md": ["5.5rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "display-lg": ["7.5rem", { lineHeight: "0.96", letterSpacing: "-0.035em" }],
        "display-xl": ["10rem", { lineHeight: "0.92", letterSpacing: "-0.04em" }],
      },
      spacing: { 18: "4.5rem", 22: "5.5rem", 30: "7.5rem" },
      transitionTimingFunction: {
        "f-cubic": "cubic-bezier(0.6, 0.0, 0.2, 1)",
        "f-cubic-in": "cubic-bezier(0.0, 0.0, 0.2, 1)",
        "f-fast": "cubic-bezier(0.5, 0, 0.1, 1)",
        "f-smooth": "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
      },
      transitionDuration: { "900": "900ms", "1500": "1500ms", "2100": "2100ms", "3000": "3000ms" },
      animation: {
        "fade-in": "fadeIn 0.9s cubic-bezier(0.6, 0.0, 0.2, 1)",
        "fade-in-up": "fadeInUp 1.5s cubic-bezier(0.6, 0.0, 0.2, 1)",
        "fade-in-down": "fadeInDown 0.9s cubic-bezier(0.6, 0.0, 0.2, 1)",
        "slow-zoom": "slowZoom 24s ease-in-out infinite alternate",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeInUp: { "0%": { opacity: "0", transform: "translateY(60px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeInDown: { "0%": { opacity: "0", transform: "translateY(-12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slowZoom: { "0%": { transform: "scale(1)" }, "100%": { transform: "scale(1.08)" } },
      },
    },
  },
  plugins: [],
};
