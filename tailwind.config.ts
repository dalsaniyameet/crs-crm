import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brand Emerald — growth & trust
        gold: {
          50:  "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        // Brand Charcoal — deep dark
        navy: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#1a1a2e",
          700: "#111120",
          800: "#0e0e16",
          900: "#0a0a0f",
          950: "#050508",
        },
        // Brand Indigo — tech accent
        crimson: {
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
        },
        // Estate indigo (compatibility)
        estate: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Cal Sans", "Inter", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to:   { transform: "scale(1)",    opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "-200px 0" },
          to:   { backgroundPosition: "calc(200px + 100%) 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px 2px rgba(234,179,8,0.3)" },
          "50%":      { boxShadow: "0 0 20px 6px rgba(234,179,8,0.6)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%":      { backgroundPosition: "100% 50%" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to:   { transform: "rotate(360deg)" },
        },
        "bounce-x": {
          "0%, 100%": { transform: "translateX(0)" },
          "50%":      { transform: "translateX(4px)" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "fade-in":         "fade-in 0.4s ease-out",
        "fade-in-up":      "fade-in-up 0.5s ease-out",
        "slide-in-right":  "slide-in-right 0.3s ease-out",
        "scale-in":        "scale-in 0.2s ease-out",
        shimmer:           "shimmer 2s infinite",
        float:             "float 4s ease-in-out infinite",
        "pulse-glow":      "pulse-glow 2s ease-in-out infinite",
        "gradient-x":      "gradient-x 5s ease infinite",
        "spin-slow":       "spin-slow 8s linear infinite",
        "bounce-x":        "bounce-x 1s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial":  "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":   "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "brand-gradient":   "linear-gradient(135deg, #0a0a0f 0%, #111120 50%, #0a0a0f 100%)",
        "gold-gradient":    "linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)",
        "glass-gradient":   "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        "card-gradient":    "linear-gradient(145deg, rgba(17,17,24,0.9), rgba(10,10,15,0.95))",
        "hero-gradient":    "radial-gradient(ellipse at 60% 0%, rgba(16,185,129,0.12) 0%, rgba(10,10,15,1) 70%)",
        "sidebar-gradient": "linear-gradient(180deg, rgba(14,14,22,0.98) 0%, rgba(10,10,15,1) 100%)",
      },
      boxShadow: {
        "glass":       "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
        "glass-sm":    "0 4px 16px rgba(0,0,0,0.3)",
        "gold":        "0 0 12px rgba(234,179,8,0.4), 0 0 24px rgba(234,179,8,0.15)",
        "gold-lg":     "0 0 20px rgba(234,179,8,0.5), 0 0 40px rgba(234,179,8,0.2)",
        "navy":        "0 0 12px rgba(30,58,95,0.6), 0 0 24px rgba(30,58,95,0.3)",
        "neon":        "0 0 10px rgba(14,165,233,0.5), 0 0 20px rgba(14,165,233,0.2)",
        "neon-gold":   "0 0 10px rgba(234,179,8,0.5), 0 0 20px rgba(234,179,8,0.2)",
        "card":        "0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover":  "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
        "inner-gold":  "inset 0 1px 0 rgba(234,179,8,0.2)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
