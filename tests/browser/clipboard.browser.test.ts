import { describe, it, expect, afterEach } from 'vitest';
import { userEvent } from 'vitest/browser';
import '../../src/index.js';
import type { FlexTable } from '../../src/flex-table.js';

/**
 * Copy, cut and paste — pressed with real keys, so the browser runs its own clipboard commands.
 *
 * The grid used to prevent Ctrl+C/X/V and call the async Clipboard API alone. When that write was
 * refused (no permission, an insecure page) the table still fired `clipboard-copy`/`clipboard-cut` —
 * and **Ctrl+X cleared the cells that never reached the clipboard**. The keys now take the browser's
 * `copy`/`cut`/`paste` event where it fires and the Clipboard API where it does not (Safari fires no
 * copy event without a text selection); a cut clears only once the text is on the clipboard.
 */

/** Stands in for Safari: the browser's copy/cut event never reaches the grid's handling. */
function withoutCopyEvent(): () => void {
  const swallow = (e: Event) => e.stopImmediatePropagation();
  window.addEventListener('copy', swallow, true);
  window.addEventListener('cut', swallow, true);
  return () => {
    window.removeEventListener('copy', swallow, true);
    window.removeEventListener('cut', swallow, true);
  };
}

let table: FlexTable;
afterEach(() => table?.remove());

async function mount(editable = true) {
  table = document.createElement('flex-table') as FlexTable;
  table.style.display = 'block';
  table.style.width = '600px';
  table.style.height = '320px';
  document.body.appendChild(table);
  table.editable = editable;
  table.columns = ['a', 'b', 'c'].map((key) => ({ key, label: key.toUpperCase(), width: 120, editable }));
  table.data = Array.from({ length: 6 }, (_, r) => ({ a: `a${r}`, b: `b${r}`, c: `c${r}` }));
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 120));
}

const cell = (row: number, col: number) =>
  table.shadowRoot!.querySelector<HTMLElement>(
    `.ft-row[aria-rowindex="${row + 2}"] .ft-cell[aria-colindex="${col + 1}"]`,
  )!;

const settle = async () => {
  await table.updateComplete;
  await new Promise((r) => setTimeout(r, 30));
};

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await settle();
};

/** Selects rows 1–2 × columns b–c. */
async function selectBlock() {
  await userEvent.click(cell(1, 1));
  await settle();
  await press('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
}

/** What the browser's copy/cut event carried, read after the table filled it. */
function recordClipboard() {
  const seen: { type: string; text: string; prevented: boolean }[] = [];
  const listen = (e: ClipboardEvent) =>
    seen.push({ type: e.type, text: e.clipboardData?.getData('text/plain') ?? '', prevented: e.defaultPrevented });
  for (const type of ['copy', 'cut'] as const) document.addEventListener(type, listen);
  return seen;
}

function recordTableEvents() {
  const seen: string[] = [];
  for (const type of ['clipboard-copy', 'clipboard-cut', 'clipboard-paste', 'clipboard-error']) {
    table.addEventListener(type, () => seen.push(type));
  }
  return seen;
}

describe('flex-table clipboard — keys', () => {
  it('Ctrl+C puts the selection on the clipboard as TSV and leaves the data alone', async () => {
    await mount();
    const clip = recordClipboard();
    const events = recordTableEvents();
    await selectBlock();
    await press('{Control>}c{/Control}');
    expect(clip).toEqual([{ type: 'copy', text: 'b1\tc1\nb2\tc2', prevented: true }]);
    expect(events).toEqual(['clipboard-copy']);
    expect([table.data[1].b, table.data[2].c]).toEqual(['b1', 'c2']);
  });

  it('Ctrl+X puts the selection on the clipboard, clears it, and Ctrl+Z brings it back', async () => {
    await mount();
    const clip = recordClipboard();
    const events = recordTableEvents();
    await selectBlock();
    await press('{Control>}x{/Control}');
    expect(clip).toEqual([{ type: 'cut', text: 'b1\tc1\nb2\tc2', prevented: true }]);
    expect(events).toEqual(['clipboard-cut']);
    expect([table.data[1].b, table.data[1].c, table.data[2].b, table.data[2].c]).toEqual(['', '', '', '']);
    await press('{Control>}z{/Control}');
    expect([table.data[1].b, table.data[2].c]).toEqual(['b1', 'c2']);
  });

  it('does not depend on the async Clipboard API — Ctrl+X works with writeText refusing', async () => {
    await mount();
    const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] };
    const original = clipboard.writeText;
    clipboard.writeText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    try {
      const clip = recordClipboard();
      const events = recordTableEvents();
      await selectBlock();
      await press('{Control>}x{/Control}');
      expect(clip.map((c) => c.text)).toEqual(['b1\tc1\nb2\tc2']);
      expect(events).toEqual(['clipboard-cut']);
    } finally {
      clipboard.writeText = original;
    }
  });

  it('a read-only table copies on Ctrl+X and clears nothing', async () => {
    await mount(false);
    const clip = recordClipboard();
    const events = recordTableEvents();
    await selectBlock();
    await press('{Control>}x{/Control}');
    expect(clip.map((c) => c.text)).toEqual(['b1\tc1\nb2\tc2']);
    expect(events).toEqual(['clipboard-copy']);
    expect(table.data[1].b).toBe('b1');
  });

  it('Ctrl+V pastes what Ctrl+C copied, starting at the active cell', async () => {
    await mount();
    const events = recordTableEvents();
    await selectBlock();
    await press('{Control>}c{/Control}');
    await userEvent.click(cell(4, 0));
    await settle();
    await press('{Control>}v{/Control}');
    expect(events).toContain('clipboard-paste');
    expect([table.data[4].a, table.data[4].b, table.data[5].a, table.data[5].b]).toEqual(['b1', 'c1', 'b2', 'c2']);
  });

  it('Ctrl+C inside the cell editor copies the editor text, not the cells', async () => {
    await mount();
    const clip = recordClipboard();
    const events = recordTableEvents();
    await userEvent.click(cell(1, 1));
    await settle();
    await press('{F2}{Control>}a{/Control}{Control>}c{/Control}');
    expect(clip).toEqual([{ type: 'copy', text: '', prevented: false }]);
    expect(events).toEqual([]);
  });
});

describe('flex-table clipboard — where the browser fires no copy event (Safari)', () => {
  it('Ctrl+X writes through the Clipboard API, then clears', async () => {
    await mount();
    const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] };
    const original = clipboard.writeText;
    const written: string[] = [];
    clipboard.writeText = async (text: string) => { written.push(text); };
    const restore = withoutCopyEvent();
    try {
      const events = recordTableEvents();
      await selectBlock();
      await press('{Control>}x{/Control}');
      await new Promise((r) => setTimeout(r, 30));
      expect(written).toEqual(['b1\tc1\nb2\tc2']);
      expect(events).toEqual(['clipboard-cut']);
      expect(table.data[1].b).toBe('');
    } finally {
      restore();
      clipboard.writeText = original;
    }
  });

  it('when the Clipboard API refuses too, Ctrl+X reports clipboard-error and clears nothing', async () => {
    await mount();
    const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] };
    const original = clipboard.writeText;
    clipboard.writeText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    const restore = withoutCopyEvent();
    try {
      const events = recordTableEvents();
      await selectBlock();
      await press('{Control>}x{/Control}');
      await new Promise((r) => setTimeout(r, 30));
      expect(events).toEqual(['clipboard-error']);
      expect([table.data[1].b, table.data[2].c]).toEqual(['b1', 'c2']);
    } finally {
      restore();
      clipboard.writeText = original;
    }
  });
});

describe('flex-table clipboard — context menu Copy', () => {
  async function menuCopy() {
    table.showContextMenu = true;
    await settle();
    const target = cell(1, 1);
    const r = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, composed: true, cancelable: true, clientX: r.left + 10, clientY: r.top + 5,
    }));
    await settle();
    const item = table.shadowRoot!.querySelector<HTMLElement>('.ft-body-context-menu .ft-context-menu-item')!;
    item.click();
    await new Promise((r) => setTimeout(r, 50));
  }

  it('reports clipboard-error and no clipboard-copy when the write is refused', async () => {
    await mount();
    const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] };
    const original = clipboard.writeText;
    clipboard.writeText = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    try {
      const events = recordTableEvents();
      await userEvent.click(cell(1, 1));
      await settle();
      await menuCopy();
      expect(events).toEqual(['clipboard-error']);
    } finally {
      clipboard.writeText = original;
    }
  });

  it('fires clipboard-copy once the write succeeds', async () => {
    await mount();
    const clipboard = navigator.clipboard as Clipboard & { writeText: Clipboard['writeText'] };
    const original = clipboard.writeText;
    const written: string[] = [];
    clipboard.writeText = (text: string) => { written.push(text); return Promise.resolve(); };
    try {
      const events = recordTableEvents();
      await userEvent.click(cell(1, 1));
      await settle();
      await menuCopy();
      expect(written).toEqual(['b1']);
      expect(events).toEqual(['clipboard-copy']);
    } finally {
      clipboard.writeText = original;
    }
  });
});
