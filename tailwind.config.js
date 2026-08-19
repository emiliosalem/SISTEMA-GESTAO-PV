/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "Helvetica", "Arial", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        teal: "#1A6B8A",
        "teal-escuro": "#14586F",
        "teal-hover": "#145771",
        laranja: "#E8520A",
        "laranja-hover": "#CF4708",
        "laranja-borda": "#D24907",
        verde: "#0F7A4A",
        "verde-bg": "#E8F5EE",
        "verde-borda": "#BFE0CE",
        ambar: "#A85B00",
        "ambar-bg": "#FDF3E0",
        "ambar-borda": "#F0D9AC",
        vermelho: "#B3251C",
        "vermelho-bg": "#FBEBE9",
        "vermelho-borda": "#F0C9C4",
        info: "#145771",
        "info-bg": "#E7F0F4",
        "info-borda": "#A8C7D4",
        tinta: "#12232B",
        "tinta-suave": "#34474F",
        legenda: "#5C7079",
        fundo: "#F1F4F5",
        borda: "#D7E0E4",
        "borda-forte": "#C6D1D6",
        "borda-fraca": "#EDF1F2",
        "metrica-bg": "#EAEEF0",
        "hover-fundo": "#F7F9FA",
      },
      borderRadius: {
        cartao: "12px",
        controle: "8px",
      },
      borderWidth: {
        fina: "0.5px",
      },
    },
  },
  plugins: [],
};
