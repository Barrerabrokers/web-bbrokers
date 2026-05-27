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
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
        serif: ["var(--font-display)", "Playfair Display", "Georgia", "serif"],
      },
      colors: {
        obsidian: {
          DEFAULT: "#151415",
          50: "#1C1B1C",
          100: "#232223",
          200: "#2E2D2E",
          300: "#3D3B3D",
          400: "#4F4D4F",
        },
        ivory: {
          DEFAULT: "#F1EADE",
          50: "#FAF7F0",
          100: "#F1EADE",
          200: "#E3D9C9",
          300: "#CFC5B5",
          400: "#A89E8E",
        },
        copper: {
          DEFAULT: "#7A523C",
          50: "#5A3B2B",
          100: "#6B4A35",
          200: "#7A523C",
          300: "#8B6248",
          400: "#A07A5E",
          500: "#B89474",
        },
        // Aliases for existing code compatibility
        ink: {
          DEFAULT: "#151415",
          50: "#F1EADE",
          100: "#CFC5B5",
          200: "#A89E8E",
          300: "#6B6560",
          400: "#4F4D4F",
          500: "#3D3B3D",
          600: "#2E2D2E",
          700: "#232223",
          800: "#1C1B1C",
          900: "#151415",
        },
        bone: {
          DEFAULT: "#F1EADE",
          50: "#FAF7F0",
          100: "#F1EADE",
          200: "#E3D9C9",
          300: "#CFC5B5",
          400: "#A89E8E",
          500: "#6B6560",
        },
        accent: {
          DEFAULT: "#7A523C",
          50: "#F1EADE",
          100: "#E3D9C9",
          200: "#B89474",
          300: "#8B6248",
          400: "#7A523C",
          500: "#6B4A35",
          600: "#5A3B2B",
          700: "#151415",
        },
        cream: {
          50: "#FAF7F0",
          100: "#F1EADE",
          200: "#E3D9C9",
          300: "#CFC5B5",
        },
      },
      borderRadius: {
        "2xl": "18px",
        xl: "14px",
        lg: "10px",
      },
      fontSize: {
        "display-xs": ["2.5rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-sm": ["3.5rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
        "display-md": ["4.5rem", { lineHeight: "1", letterSpacing: "-0.03em" }],
        "display-lg": ["6rem", { lineHeight: "0.95", letterSpacing: "-0.035em" }],
        "display-xl": ["8rem", { lineHeight: "0.9", letterSpacing: "-0.04em" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
        "in-out-cubic": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        "900": "900ms",
        "1200": "1200ms",
        "1500": "1500ms",
        "2000": "2000ms",
      },
      animation: {
        "fade-in": "fadeIn 0.8s cubic-bezier(0.19, 1, 0.22, 1)",
        "fade-up": "fadeUp 1s cubic-bezier(0.19, 1, 0.22, 1)",
        "slide-up": "slideUp 0.8s cubic-bezier(0.19, 1, 0.22, 1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
