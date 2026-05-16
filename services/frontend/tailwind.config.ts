import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        felt: "var(--color-felt)",
        accent: "var(--color-gold)",
        text: "var(--color-text-primary)",
        muted: "var(--color-text-secondary)",
        danger: "var(--color-danger)",
        success: "var(--color-success)"
      },
      fontFamily: {
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      boxShadow: {
        table: "var(--shadow-table)",
        lift: "var(--shadow-lift)"
      }
    }
  },
  plugins: []
};

export default config;
