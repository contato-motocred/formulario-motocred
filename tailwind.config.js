/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./**/*.html",
    "./src/**/*.{js,ts,jsx,tsx,css}",
    "./scripts/**/*.{js,ts}",
  ],

  // 👇👇 Adicione estas duas linhas:
  prefix: "v2-",              // prefixo das classes (v2-bg..., v2-flex...)
  corePlugins: { preflight: false }, // desativa reset global (igual ao usado no HTML)

  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#F37521",
          dark: "#d4631c",
          light: "#f99857",
        },
      },
      fontFamily: {
        sans: ["Segoe UI", "Tahoma", "Arial", "sans-serif"],
        heading: ["Segoe UI", "Tahoma", "Arial", "sans-serif"],
      },
      borderRadius: {
        xl2: "2.25rem",
      },
      boxShadow: {
        card: "0 28px 60px rgba(0, 0, 0, 0.14)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
