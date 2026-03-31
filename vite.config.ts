import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'flex-table': resolve(__dirname, 'src/index.ts'),
        'react': resolve(__dirname, 'src/react.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['lit', /^lit\//, 'react', /^react\//, '@lit/react', /^@lit\/react/],
    },
  },
});
