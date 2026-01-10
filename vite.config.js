import { defineConfig } from 'vite';
import { resolve } from 'path';
import { socketIOPlugin } from './server/vite-socket-plugin.js';

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [socketIOPlugin()],
  server: {
    port: 5173,
    open: true,
    host: true
  },
  build: {
    outDir: '../dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
      output: {
        manualChunks: undefined
      }
    }
  }
});
