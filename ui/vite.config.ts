import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolveDevApiTarget } from "./dev/resolveDevApiTarget.mjs";

const apiTarget = resolveDevApiTarget();
console.log(`[ima2] /api proxy -> ${apiTarget.url} (source: ${apiTarget.source})`);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget.url,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
