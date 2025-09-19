import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Get current directory
const __dirname = path.resolve();

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
