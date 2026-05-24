/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        // Mantengo serif por compat (algunas paginas legacy lo usan)
        serif: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Linear-inspired neutral scale (override)
        gray: {
          50: "#f7f8f8",
          100: "#e6e6e7",
          200: "#cccdce",
          300: "#a8aaae",
          400: "#8a8f98",
          500: "#62666d",
          600: "#42464d",
          700: "#2a2b30",
          750: "#222327",
          800: "#1c1d20",
          850: "#16171a",
          900: "#101113",
          950: "#08090a",
        },
        // Linear signature purple
        accent: {
          DEFAULT: "#5e6ad2",
          50: "#ecedfa",
          100: "#dadcf5",
          200: "#b6b9eb",
          300: "#9095e0",
          400: "#7170ff",
          500: "#5e6ad2",
          600: "#4d57b5",
          700: "#3d4179",
          800: "#2e324f",
          900: "#1a1d35",
        },
        // Aliases legacy (admin antiguo) mapeados a la paleta dark.
        // Asi las paginas que aun usen "charcoal-*" o "gold-*" siguen
        // funcionando hasta que se migren todas.
        charcoal: {
          50: "#1c1d20",
          100: "#16171a",
          200: "#1f1f24",
          300: "#2a2b30",
          400: "#42464d",
          500: "#62666d",
          600: "#8a8f98",
          700: "#a8aaae",
          800: "#cccdce",
          900: "#f7f8f8",
        },
        gold: {
          50: "rgba(94, 106, 210, 0.05)",
          100: "rgba(94, 106, 210, 0.10)",
          200: "rgba(94, 106, 210, 0.20)",
          300: "#9095e0",
          400: "#7170ff",
          500: "#5e6ad2",
          600: "#5e6ad2",
          700: "#4d57b5",
          800: "#3d4179",
          900: "#2e324f",
        },
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.025em",
        tight: "-0.01em",
        widest: "0.18em",
      },
      backgroundImage: {
        "gradient-radial":
          "radial-gradient(circle at center, var(--tw-gradient-stops))",
        "gradient-radial-tl":
          "radial-gradient(circle at top left, var(--tw-gradient-stops))",
        "gradient-radial-tr":
          "radial-gradient(circle at top right, var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        glow: "0 0 24px 0 rgba(94, 106, 210, 0.35)",
        "glow-lg": "0 0 48px 0 rgba(94, 106, 210, 0.45)",
        "soft": "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.6)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "fade-in-up": "fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in-down": "fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        glow: "glowPulse 4s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.9" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
