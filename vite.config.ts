import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    watch: {
      ignored: [
        "**/backend/**",
        "**/docs/**",
        "**/test-results/**",
        "**/playwright-report/**",
        "**/.venv/**",
      ],
    },
    proxy: { "/api": process.env.AQUARELAY_API_URL || "http://127.0.0.1:8000" },
  },
  build: { chunkSizeWarningLimit: 1200 },
});
