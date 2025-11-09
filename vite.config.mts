import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3008",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:3008",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://127.0.0.1:3008",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
