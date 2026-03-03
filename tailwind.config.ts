import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./pdf/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        viasoft: {
          DEFAULT: "#003A4D",
          50: "#ecf2f4",
          100: "#d8e5e9",
          200: "#b2cad3",
          300: "#8caebc",
          400: "#4f7f92",
          500: "#003A4D",
          600: "#003345",
          700: "#002c3c",
          800: "#002433",
          900: "#001d29"
        },
        ink: "#142227",
        slate: "#35464f",
        mist: "#edf2f4",
        emerald: "#0f766e",
        amber: "#b45309",
        rose: "#b42318"
      },
      boxShadow: {
        panel: "0 10px 30px -15px rgba(20, 34, 39, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
