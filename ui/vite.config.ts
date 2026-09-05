import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolveDevApiTarget } from "./dev/resolveDevApiTarget.mjs";
import { fixtureTailwindSources } from "./dev/fixtureTailwindSources.mjs";

const apiTarget = resolveDevApiTarget();
console.log(`[ima2] /api proxy -> ${apiTarget.url} (source: ${apiTarget.source})`);

export default defineConfig({
  plugins: [
    ...(process.env.IMA2_UI_RECEIPT_BUILD === "1" ? [fixtureTailwindSources()] : []),
    react(), tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget.url,
        changeOrigin: true,
      },
      // Generated media lives on the API server, not in ui/public. Without
      // this the dev server answers /generated with its index.html and every
      // history thumbnail renders broken — which reads as a UI bug that
      // production does not have (server.ts serves /generated directly).
      "/generated": {
        target: apiTarget.url,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    manifest: true,
    sourcemap: process.env.VITE_SOURCEMAP === "1",
  },
});
