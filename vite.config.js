import { defineConfig } from 'vite';

export default defineConfig({
  root: 'docs',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:9802',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:9802',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
