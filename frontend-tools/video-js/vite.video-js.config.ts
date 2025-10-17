import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    root: path.resolve(__dirname, 'src'),
    define: {
        'process.env': {
            NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production'),
        },
    },
    build: {
        minify: true,
        sourcemap: true,
        lib: {
            entry: path.resolve(__dirname, 'src/main.jsx'),
            name: 'VideoJS',
            formats: ['iife'],
            fileName: () => 'video-js.js',
        },
        rollupOptions: {
            output: {
                // Ensure CSS file has a predictable name
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') return 'video-js.css';
                    return assetInfo.name;
                },
                // Add this to ensure the final bundle exposes React correctly
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                },
            },
        },
        // Output to Django's static directory
        outDir: '../../../static/video_js',
        emptyOutDir: true,
        external: ['react', 'react-dom'],
    },
});
