/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        accent: "#000000",
        success: "#000000",
        danger: "#000000",
        warning: "#555555",
        info: "#000000",
      },
    },
  },
  plugins: [],
};
