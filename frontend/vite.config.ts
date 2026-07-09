import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(here, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev: proxy API + SSE to the local backend so there's no CORS friction.
      "/api": { target: "http://localhost:8787", changeOrigin: true },
      "/a2a": { target: "http://localhost:8787", changeOrigin: true },
      "/health": { target: "http://localhost:8787", changeOrigin: true },
    },
  },
});
