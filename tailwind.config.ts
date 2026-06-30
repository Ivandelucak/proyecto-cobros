import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#F4F6F8",
          100: "#DCE8F1",
          200: "#D5DEE6",
          300: "#7C96AB",
          400: "#8CA3B7",
          500: "#2E5B7A",
          600: "#244761",
          700: "#16212B",
          800: "#1D3140",
          900: "#0B1015"
        },
        signal: {
          accent: "#8CA3B7",
          success: "#1F8F63",
          sky: "#4C7FA3"
        }
      }
    }
  },
  plugins: []
};

export default config;
