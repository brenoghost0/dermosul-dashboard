import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) {
              return "react-vendor";
            }
            if (id.includes("react-router-dom") || id.includes("react-router")) {
              return "router-vendor";
            }
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:3008",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3008",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:3008",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
