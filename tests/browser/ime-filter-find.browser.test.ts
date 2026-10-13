import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';
import { compose, commit } from './ime.js';

/**
 * 텍스트 필터 · 찾기 · 자동완성 칸에서 한국어 IME 로 «서울» 을 치는 동안 — 조합 중인 음절(«ㅅ» · «성»)로 거르지 않는다.
 * 필터와 찾기는 조합이 끝날 때 적용하고(필터 술어가 바깥에 알려진다), 자동완성 후보는 확정된 부분의 접두로 고른다.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let table: FlexTable;
afterEach(() => table?.remove());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

async function mount(columns: Any[]): Promise<Any> {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '500px';
  table.style.height = '300px';
  document.body.appendChild(table);
  const any = table as Any;
  any.columns = columns;
  any.data = [{ city: '서울' }, { city: '성남' }, { city: '부산' }];
  await table.updateComplete;
  await sleep(120);
  return any;
}

describe('flex-table — 조합 중 거르기', () => {
  it('텍스트 필터: 조합 중에는 적용하지 않고, 조합이 끝날 때 확정 글자로 적용한다', async () => {
    const any = await mount([{ key: 'city', label: 'City', type: 'text', width: 160 }]);
    const events: number[] = [];
    table.addEventListener('filter-change', (e) => events.push((e as CustomEvent).detail.filteredCount));
    any._openFilterFromMenu('city');
    await table.updateComplete;
    await sleep(100); // 필터는 열린 뒤 첫 컨트롤에 스스로 포커스를 준다 — 그 뒤에 텍스트 칸으로 옮긴다
    const input = table.shadowRoot!.querySelector('.ft-filter-input') as HTMLInputElement;
    input.focus();

    await compose(['ㅅ', '서', '성']);
    await table.updateComplete;
    expect(events, '조합 중 술어 없음').toEqual([]);
    expect(any.filteredRowCount).toBe(3);

    await commit('서');
    await compose(['우', '울']);
    await table.updateComplete;
    expect(events).toEqual([1]);
    expect(any.filteredRowCount).toBe(1);

    await commit('울');
    await table.updateComplete;
    expect(input.value).toBe('서울');
    expect(events.at(-1)).toBe(1);
  });

  it('찾기: 조합 중에는 «결과 없음» 을 보이지 않는다', async () => {
    const any = await mount([{ key: 'city', label: 'City', type: 'text', width: 160 }]);
    any._openFindPanel('find');
    await table.updateComplete;
    await sleep(100);
    const input = table.shadowRoot!.querySelector('.ft-find-input') as HTMLInputElement;
    const count = () => table.shadowRoot!.querySelector('.ft-find-count')!.textContent!.trim();
    input.focus();
    const seen: string[] = [];
    for (const step of ['ㅅ', '서', '성']) {
      await compose([step]);
      await table.updateComplete;
      seen.push(count());
    }
    await commit('서');
    await table.updateComplete;
    seen.push(count());
    expect(seen.slice(0, 3)).toEqual(['', '', '']);
    expect(seen[3]).toBe('1/1');
  });

  it('자동완성: 조합 중 후보는 확정된 부분의 접두로 고른다 — «서우» 에서도 서울이 후보다', async () => {
    const any = await mount([{ key: 'city', label: 'City', autocomplete: true, width: 160 }]);
    any._selection.setActive(2, 0);
    any._syncActiveCell();
    any._startEdit();
    await table.updateComplete;
    const editor = table.shadowRoot!.querySelector('.ft-editor') as HTMLInputElement;
    editor.focus();
    editor.select();
    const candidates = () => [...table.shadowRoot!.querySelectorAll('.ft-autocomplete-item')].map((n) => n.textContent!.trim());

    await compose(['ㅅ', '서']);
    await commit('서');
    await compose(['우']);
    await table.updateComplete;
    expect(candidates()).toEqual(['서울']);
  });
});

describe('flex-table — 검색 일치(자모 · 초성)', () => {
  it('텍스트 필터 «포함» 은 확정된 음절을 음절 그대로 견준다 — «서» 는 성남이 아니다', async () => {
    const any = await mount([{ key: 'city', label: 'City', type: 'text', width: 160 }]);
    any._textFilterState.set('city', { value: '서', mode: 'contains' });
    any._applyTextFilter('city');
    await table.updateComplete;
    expect(any.filteredRowCount).toBe(1);
  });

  it('텍스트 필터 «포함» 은 초성으로도 찾는다 — «ㅅㅇ» 은 서울', async () => {
    const any = await mount([{ key: 'city', label: 'City', type: 'text', width: 160 }]);
    any._textFilterState.set('city', { value: 'ㅅㅇ', mode: 'contains' });
    any._applyTextFilter('city');
    await table.updateComplete;
    expect(any.filteredRowCount).toBe(1);
  });

  it('자동완성: 글 끝에서 조합 중인 «성» 은 자모로 서울 · 성남을 후보로 낸다', async () => {
    const any = await mount([{ key: 'city', label: 'City', autocomplete: true, width: 160 }]);
    any._selection.setActive(2, 0);
    any._syncActiveCell();
    any._startEdit();
    await table.updateComplete;
    const editor = table.shadowRoot!.querySelector('.ft-editor') as HTMLInputElement;
    editor.focus();
    editor.select();
    await compose(['ㅅ', '서', '성']);
    await table.updateComplete;
    const candidates = [...table.shadowRoot!.querySelectorAll('.ft-autocomplete-item')].map((n) => n.textContent!.trim());
    expect(candidates).toEqual(['서울', '성남']);
  });
});
