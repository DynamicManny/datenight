import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../lighthouse', emptyOutDir: true, assetsInlineLimit: 0, chunkSizeWarningLimit: 900 }
});
