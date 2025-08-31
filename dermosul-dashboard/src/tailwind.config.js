/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Dermosul
        brand: {
          50:  "#f7f5ef",   // bege do fundo
          600: "#175544",   // verde principal (botões)
          700: "#154d3e",
          800: "#153E2E",   // títulos
        },
      },
      boxShadow: {
        card: "0 6px 24px rgba(0,0,0,.08)",
      },
    },
  },
  plugins: [],
};