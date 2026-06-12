/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FF006E",
          50: "#ffe5f0",
          100: "#ffb3d2",
          200: "#ff80b5",
          300: "#ff4d97",
          400: "#ff1a79",
          500: "#ff006e",
          600: "#e60062",
          700: "#cc0055",
          800: "#b30049",
          900: "#99003c"
        }
      }
    }
  },
  plugins: [],
};
