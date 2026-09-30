import { describe, it, expect, afterEach } from 'vitest';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * 셀 편집 중 IME 조합(한국어 등)을 확정하는 Enter 는 확정·아래 이동이 아니다.
 * 조합 중 keydown 은 `isComposing: true`, Safari 의 확정 키는 `keyCode: 229` 로 온다 — 둘 다 잰다.
 */
const key = (init: KeyboardEventInit & { keyCode?: number }) => {
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(e, 'keyCode', { value: init.keyCode });
  return e;
};

let table: FlexTable;
afterEach(() => table?.remove());

async function editing(): Promise<{ editor: () => HTMLInputElement | null }> {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '500px';
  table.style.height = '300px';
  document.body.appendChild(table);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const any = table as any;
  any.columns = [{ key: 'a', label: 'A', type: 'text', width: 160 }];
  any.data = [{ a: '가' }, { a: 'b' }];
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
  any._selection.setActive(0, 0);
  any._syncActiveCell();
  any._startEdit();
  await table.updateComplete;
  const editor = () => table.shadowRoot!.querySelector('.ft-editor') as HTMLInputElement | null;
  expect(editor(), '전제: 편집 중').not.toBeNull();
  return { editor };
}

describe('flex-table — 편집 중 조합을 확정하는 Enter 로 확정하지 않는다', () => {
  it.each([
    ['isComposing', { isComposing: true }],
    ['keyCode 229(Safari)', { keyCode: 229 }],
  ])('%s', async (_n, init) => {
    const { editor } = await editing();
    editor()!.dispatchEvent(key(init));
    await table.updateComplete;
    expect(editor()).not.toBeNull();
  });

  it('대조군 — 보통 Enter 는 확정한다', async () => {
    const { editor } = await editing();
    editor()!.dispatchEvent(key({ keyCode: 13 }));
    await table.updateComplete;
    expect(editor()).toBeNull();
  });
});
