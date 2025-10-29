/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "./script.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F37521",
          dark: "#d4631c",
          light: "#f99857"
        }
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "Arial", "sans-serif"],
        heading: ["Segoe UI", "Tahoma", "Arial", "sans-serif"]
      },
      borderRadius: {
        xl2: "2.25rem"
      },
      boxShadow: {
        card: "0 28px 60px rgba(0, 0, 0, 0.14)"
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
}
