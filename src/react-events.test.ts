import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * React 래퍼가 `<flex-table>` 이 내는 커스텀 이벤트를 **전부** `on*` prop 으로 잇는가.
 *
 * README 는 «모든 커스텀 이벤트가 `on*` 콜백으로 매핑된다» 고 약속하는데, 이벤트가 늘 때 매핑 표를
 * 함께 고치지 않아 일곱이 빠져 있었다(`row-reorder`·`column-visibility-change`·`comment-change`·
 * `data-import`·`fill-handle-apply`·`find-replace`·`header-context-menu`). 목록을 손으로 적지 않고
 * 소스의 `dispatchEvent(new CustomEvent('…'` 에서 도출해 대조한다 — 다음에 늘어나는 이벤트도 여기서 걸린다.
 */
const read = (f: string) => readFileSync(join(__dirname, f), 'utf-8');

describe('React 이벤트 매핑', () => {
  it('flex-table 이 내는 커스텀 이벤트가 전부 React prop 으로 매핑돼 있다', () => {
    const dispatched = new Set(
      [...read('flex-table.ts').matchAll(/dispatchEvent\(\s*new CustomEvent\(\s*'([a-z-]+)'/g)].map((m) => m[1]),
    );
    const mapped = new Set([...read('react.ts').matchAll(/:\s*'([a-z-]+)'\s+as EventName/g)].map((m) => m[1]));
    expect(dispatched.size).toBeGreaterThan(20);
    expect([...dispatched].filter((e) => !mapped.has(e)).sort()).toEqual([]);
  });
});
