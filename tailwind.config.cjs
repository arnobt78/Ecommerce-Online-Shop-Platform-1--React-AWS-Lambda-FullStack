module.exports = {
  content: ["./index.html", "./src/**/*.{html,js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: "#1E293B",
      },
      // Tailwind's default max-w scale stops at 7xl (80rem) — extended here
      // for the centralized page-content wrapper (App.tsx / AdminLayout.tsx).
      maxWidth: {
        "8xl": "88rem",
        "9xl": "96rem",
      },
      keyframes: {
        // RippleButton (docs/RIPPLE_BUTTON_EFFECT.md): expand + fade from the click point.
        ripple: {
          "0%": { transform: "scale(0)", opacity: "0.35" },
          "100%": { transform: "scale(1)", opacity: "0" },
        },
        // CTA shine sweep (docs/RIPPLE_BUTTON_EFFECT.md "CTA Shine" section).
        "cta-shine": {
          "0%": { transform: "translateX(-100%) skewX(-8deg)" },
          "100%": { transform: "translateX(200%) skewX(-8deg)" },
        },
      },
      animation: {
        ripple: "ripple 600ms ease-out forwards",
        "cta-shine": "cta-shine 4.5s cubic-bezier(0.35, 0, 0.15, 1) infinite",
      },
    },
  },
  plugins: [],
}