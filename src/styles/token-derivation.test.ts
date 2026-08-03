import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const src = readFileSync(resolve(__dirname, 'flex-table.styles.ts'), 'utf-8');

/**
 * **`--ft-*` 가 `--u-*` 디자인 시스템에서 파생한다**는 계약.
 *
 * 종전에는 이 표가 Google 계열 팔레트를 리터럴로 갖고 있어, 소비자가 셸·버튼의 브랜드를
 * 맞춰도 **표만 다른 색 체계**로 남았다. 업무앱에서 표는 화면 면적의 대부분이라 체감이
 * 바뀌지 않는다.
 *
 * ⚠**독립 사용을 깨뜨리지 않는 것이 이 파생의 조건이다** — 리터럴은 `var()` 의 폴백으로
 * 살아 있고, 다크 블록도 남아 있어 시트 없이도 종전처럼 자체 테마를 갖는다.
 * 이 파일은 그 두 가지를 함께 지킨다.
 */
describe('--ft-* 토큰 파생', () => {
  /** `:host { … }` 첫 블록 = 라이트 기본값 */
  const baseBlock = src.slice(src.indexOf(':host {'), src.indexOf('/* --- Dark Theme'));

  const colorTokens = [...baseBlock.matchAll(/^\s*(--ft-[\w-]+):\s*([^;]+);/gm)]
    .map(([, name, value]) => ({ name, value: value.trim() }))
    // 색이 아닌 축(글꼴·치수)은 이 계약의 대상이 아니다.
    .filter(t => !/font|size|width|height|radius|spacing/.test(t.name));

  it('색 토큰이 하나 이상 잡힌다 (이 테스트가 공허하게 통과하지 않는다)', () => {
    expect(colorTokens.length).toBeGreaterThan(10);
  });

  it('★모든 색 토큰이 --u-* 또는 다른 --ft-* 에서 파생한다', () => {
    const literal = colorTokens.filter(
      t => !t.value.includes('var(--u-') && !t.value.includes('var(--ft-'),
    );
    expect(literal.map(t => `${t.name}: ${t.value}`), '리터럴로 남은 색 토큰').toEqual([]);
  });

  it('★--u-* 참조는 전부 리터럴 폴백을 갖는다 (시트 없이도 렌더된다)', () => {
    // `var(--u-x)` 로 폴백 없이 쓰면 시트가 없을 때 선언이 통째로 버려진다.
    const bare = [...src.matchAll(/var\(\s*(--u-[\w-]+)\s*\)/g)].map(m => m[1]);
    expect([...new Set(bare)], '폴백 없는 --u-* 참조').toEqual([]);
  });

  it('★다크 블록이 남아 있다 (시트 없는 소비자의 자체 테마)', () => {
    // 파생만 하고 다크 블록을 지우면, 시트를 로드하지 않는 소비자는 라이트 폴백에
    // 갇힌다 — 이 패키지가 원래 갖고 있던 계약이 사라진다.
    expect(src).toContain('@media (prefers-color-scheme: dark)');
    expect(src).toContain(':host([theme="dark"])');
    const darkBlock = src.slice(src.indexOf('/* --- Dark Theme'), src.indexOf('/* --- Layout'));
    expect((darkBlock.match(/--ft-[\w-]+:/g) || []).length, '다크 블록의 토큰 수')
      .toBeGreaterThan(20);
  });

  it('★규칙 본문에 유채색 리터럴이 남아 있지 않다', () => {
    // 무채색(그림자·스크림)은 대상이 아니다 — 팔레트 색이 아니기 때문이다.
    const offenders: string[] = [];
    src.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        if (r === g && g === b) continue;
        offenders.push(`${i + 1}: ${m[0]})`);
      }
      // 명명색(`orange` 등)도 같은 부류다. 폴백 안의 hex 는 정당하므로 제외한다.
      const named = line.match(/:\s*(orange|red|blue|green|yellow|purple|pink)\s*[;!]/);
      if (named) offenders.push(`${i + 1}: ${named[1]}`);
    });
    expect(offenders, '규칙 본문의 유채색 리터럴').toEqual([]);
  });
});
