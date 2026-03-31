import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  base: '/flex-table/',
  build: {
    outDir: resolve(__dirname, 'demo-dist'),
    emptyOutDir: true,
  },
});
