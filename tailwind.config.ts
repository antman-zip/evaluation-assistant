import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "#1F2937",
          teal: "#0F766E",
          mint: "#CCFBF1",
          sand: "#FFF7ED",
          coral: "#FB7185"
        }
      },
      boxShadow: {
        card: "0 16px 40px rgba(15, 118, 110, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
