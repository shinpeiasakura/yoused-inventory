/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Noto Serif JP'", 'Georgia', 'ui-serif', 'serif'],
      },
    },
  },
  plugins: [],
}
