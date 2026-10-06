import { describe, it, expect, afterEach } from 'vitest';
import { Locale } from '@iyulab/components/dist/utilities/Locale.js';
import '../../src/flex-table.js';
import { flexTableLocale } from '../../src/locale.js';

/**
 * 런타임 로캘 전환 — `flex-table` 은 `LitElement` 를 직접 잇기에 `@iyulab/components` 의 `UElement` 구독을 받지 못한다.
 * 스스로 구독해 이미 그려진 문장을 새 언어로 다시 그린다. 종전에는 다음 재렌더(스크롤·데이터 변경)까지 옛 언어였다.
 */
type Table = HTMLElement & { updateComplete: Promise<unknown> };
const settle = async (el: Table) => { await el.updateComplete; await new Promise((r) => setTimeout(r, 30)); };

describe('flex-table 런타임 로캘 전환', () => {
  afterEach(() => { document.body.innerHTML = ''; Locale.set('en'); });

  it('그려진 문장이 Locale.set 을 따라온다', async () => {
    Locale.set('en');
    document.body.innerHTML = '<flex-table style="height:200px"></flex-table>';
    const el = document.querySelector('flex-table') as Table;
    await settle(el);
    expect(el.shadowRoot!.textContent).toContain(flexTableLocale.text('noColumnsDefined'));
    Locale.set('ko');
    await settle(el);
    expect(el.shadowRoot!.textContent).toContain(flexTableLocale.text('noColumnsDefined'));
    expect(flexTableLocale.text('noColumnsDefined')).not.toBe('No columns defined');
  });

  it('떨어져 있던 동안의 전환을 다시 붙을 때 따라간다', async () => {
    Locale.set('en');
    document.body.innerHTML = '<flex-table style="height:200px"></flex-table>';
    const el = document.querySelector('flex-table') as Table;
    await settle(el);
    el.remove();
    Locale.set('ko');
    document.body.append(el);
    await settle(el);
    expect(el.shadowRoot!.textContent).toContain(flexTableLocale.text('noColumnsDefined'));
  });
});
