import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
    cors: true,
  },
});
