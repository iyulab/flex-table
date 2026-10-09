import { defineConfig } from 'vite';
import { resolve } from 'path';
import stripCssComments from '@iyulab/components/plugins/vite-plugin-strip-css-comments.js';

export default defineConfig({
  plugins: [
    // `css` 템플릿 안 주석은 문자열이라 번들러가 지우지 못한다 — 정본 플러그인으로 걷는다(components `plugins/`).
    stripCssComments(),
  ],
  build: {
    lib: {
      entry: {
        'flex-table': resolve(__dirname, 'src/index.ts'),
        'react': resolve(__dirname, 'src/react.ts'),
        'odata/index': resolve(__dirname, 'src/odata/index.ts'),
        'array/index': resolve(__dirname, 'src/array/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // 필수 peer `@iyulab/components` 도 번들에 넣지 않는다 — 넣으면 `Locale` 같은 모듈 상태가 사본으로
      // 갈라져 앱의 `Locale.set()` 이 이 패키지에 닿지 않는다(0.40.1 까지 실측: dist 에 그 사본이 있었다).
      external: ['lit', /^lit\//, 'react', /^react\//, '@lit/react', /^@lit\/react/, 'odata-query', /^@iyulab\/components(\/|$)/],
    },
  },
});
