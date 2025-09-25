import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        svgr({
            // Options for svgr
            svgrOptions: {
                exportType: 'default',
            },
        }),
    ],
});
