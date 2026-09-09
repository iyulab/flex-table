import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

// - unit:    src/**/*.test.ts. jsdom 에서 돈다.
// - browser: **jsdom 이 원리적으로 볼 수 없는 것**을 측정한다.
//
// ⚠browser 프로젝트가 왜 필요했는가: 이 컴포넌트는 가로 가상 스크롤 때문에 셀을
// 전부 `position: absolute` 로 놓고, 어느 셀이 어디에 오는지를 스스로 계산한다.
// 그런데 jsdom 은 레이아웃을 계산하지 않아 `getBoundingClientRect()` 가 전부 0 이다
// ⇒ ***이 패키지의 핵심 메커니즘이 유닛 테스트의 시야 밖에 있다.***
//
// 실제로 그 공백에서 결함이 나왔다(docket #233): 오른쪽 고정 열이 뷰포트가 아니라
// 스크롤 내용에 붙어 한 번도 보이지 않았고, 게다가 스크롤할 때마다 스크롤 가능 폭이
// 늘어나 스크롤바가 자기 끝에 닿지 못했다. 유닛 테스트 둘이 그 자리를 «초록으로»
// 지키고 있었는데, 둘 다 배치가 아니라 **어떤 CSS 프로퍼티가 emit 되는가**를 단언하고
// 있었기 때문이다. emit 되는 문자열은 배치가 아니다.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            // 고정 포트 이유는 packages/components/vitest.config.ts 참조.
            // 41501~41505 는 형제 패키지가 쓰고 있다.
            api: { host: '127.0.0.1', port: 41506 },
          },
          isolate: true,
        },
      },
    ],
  },
});
