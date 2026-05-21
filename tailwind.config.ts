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
        // Brand Gold — premium real estate
        gold: {
          50:  "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          950: "#422006",
        },
        // Brand Navy — deep professional
        navy: {
          50:  "#f0f4ff",
          100: "#e0e9ff",
          200: "#c7d6fe",
          300: "#a5b8fc",
          400: "#8191f8",
          500: "#6366f1",
          600: "#1e3a5f",
          700: "#162d4a",
          800: "#0f1f35",
          900: "#080f1a",
          950: "#04080f",
        },
        // Brand Crimson — accent
        crimson: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        // Estate blue (kept for compatibility)
        estate: {
          50:  "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
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
        "brand-gradient":   "linear-gradient(135deg, #0f1f35 0%, #1e3a5f 50%, #0f1f35 100%)",
        "gold-gradient":    "linear-gradient(135deg, #ca8a04 0%, #eab308 50%, #facc15 100%)",
        "glass-gradient":   "linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))",
        "card-gradient":    "linear-gradient(145deg, rgba(30,58,95,0.4), rgba(8,15,26,0.6))",
        "hero-gradient":    "radial-gradient(ellipse at 60% 0%, rgba(30,58,95,0.8) 0%, rgba(4,8,15,1) 70%)",
        "sidebar-gradient": "linear-gradient(180deg, rgba(15,31,53,0.95) 0%, rgba(4,8,15,0.98) 100%)",
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
