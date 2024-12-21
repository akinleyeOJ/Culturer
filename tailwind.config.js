/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#fdeee9",
          100: "#fbd4c7",
          200: "#f5a895",
          300: "#ec7d63",
          400: "#db5a45",
          500: "#bf4837",
        },
        secondary: {
          50: "#fff7e7",
          100: "#ffebc2",
          200: "#ffd48f",
          300: "#ffc05e",
          400: "#e5a444",
          500: "#cc8b2b",
        },
        accent: {
          50: "#e3f7f5",
          100: "#b6ebe5",
          200: "#88ded4",
          300: "#5acfc3",
          400: "#34b9aa",
          500: "#2a9188",
        },
        background: {
          50: "#fffdfc",
          100: "#fff9f2",
          200: "#fef5e5",
          300: "#fcf0d8",
          400: "#f9e5bc",
          500: "#f2d7a3",
        },
        text: {
          50: "#f4f4f4",
          100: "#d9d9d9",
          200: "#bfbfbf",
          300: "#a3a3a3",
          400: "#666666",
          500: "#264653",
        },
        warning: {
          50: "#fffbea",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        danger: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
