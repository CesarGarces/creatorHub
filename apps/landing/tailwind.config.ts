import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F19",
        surface: {
          DEFAULT: "#121826",
          elevated: "#1A2236",
        },
        border: {
          DEFAULT: "#1E293B",
          subtle: "#162032",
        },
        primary: {
          DEFAULT: "#7C3AED",
          hover: "#6D28D9",
          light: "#7C3AED20",
        },
        accent: {
          DEFAULT: "#06B6D4",
          light: "#06B6D420",
        },
        success: {
          DEFAULT: "#22C55E",
          light: "#22C55E20",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#F59E0B20",
        },
        error: {
          DEFAULT: "#EF4444",
          light: "#EF444420",
        },
        text: {
          DEFAULT: "#F1F5F9",
          muted: "#94A3B8",
          dim: "#475569",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "slide-down": "slideDown 0.5s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        shimmer: "shimmer 2s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
