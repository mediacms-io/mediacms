import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production')
    }
  },
  build: {
    minify: true,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'client/src/main.tsx'),
      name: 'VideoEditor',
      formats: ['iife'],
      fileName: () => 'video-editor.js',
    },
    rollupOptions: {
      output: {
        // Ensure CSS file has a predictable name and keep image assets
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'video-editor.css';
          // Keep original names for image assets
          if (assetInfo.name && /\.(png|jpe?g|svg|gif|webp)$/i.test(assetInfo.name)) {
            return assetInfo.name;
          }
          return assetInfo.name || 'asset-[hash][extname]';
        },
        // Inline small assets, emit larger ones
        inlineDynamicImports: true,
        // Add this to ensure the final bundle exposes React correctly
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM'
        }
      },
    },
    // Output to Django's static directory
    outDir: '../../../static/video_editor',
    emptyOutDir: true,
    external: ['react', 'react-dom'],
    // Inline assets smaller than 100KB, emit larger ones
    assetsInlineLimit: 102400,
  },
});