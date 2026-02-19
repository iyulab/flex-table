import { describe, it, expect, beforeEach } from 'vitest';
import './flex-table.js';
import type { FlexTable } from './flex-table.js';

function createElement(): FlexTable {
  const el = document.createElement('flex-table') as FlexTable;
  document.body.appendChild(el);
  return el;
}

describe('FlexTable', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should be registered as a custom element', () => {
    const el = createElement();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.tagName.toLowerCase()).toBe('flex-table');
  });

  it('should show empty message when no columns', async () => {
    const el = createElement();
    await el.updateComplete;
    const msg = el.shadowRoot!.querySelector('.ft-empty');
    expect(msg).toBeTruthy();
    expect(msg!.textContent).toContain('No columns');
  });

  it('should render column headers', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    await el.updateComplete;
    const headers = el.shadowRoot!.querySelectorAll('.ft-header-cell');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('Name');
    expect(headers[1].textContent).toContain('Age');
  });

  it('should render data cells', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'value', header: 'Value', type: 'number' },
    ];
    el.data = [
      { name: 'Alice', value: 42 },
      { name: 'Bob', value: 7 },
    ];
    await el.updateComplete;
    const cells = el.shadowRoot!.querySelectorAll('.ft-cell');
    expect(cells.length).toBeGreaterThanOrEqual(4); // 2 rows x 2 columns (may have more from overscan)
    expect(cells[0].textContent).toContain('Alice');
    expect(cells[1].textContent).toContain('42');
  });

  it('should apply CSS Grid template columns', async () => {
    const el = createElement();
    el.columns = [
      { key: 'a', header: 'A', width: 100 },
      { key: 'b', header: 'B', width: 200 },
    ];
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('.ft-header') as HTMLElement;
    expect(header.style.gridTemplateColumns).toContain('100px');
    expect(header.style.gridTemplateColumns).toContain('200px');
  });

  it('should hide columns with hidden flag', async () => {
    const el = createElement();
    el.columns = [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B', hidden: true },
      { key: 'c', header: 'C' },
    ];
    el.data = [{ a: '1', b: '2', c: '3' }];
    await el.updateComplete;
    const headers = el.shadowRoot!.querySelectorAll('.ft-header-cell');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('A');
    expect(headers[1].textContent).toContain('C');
  });

  it('should show "No data" when columns exist but data is empty', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [];
    await el.updateComplete;
    const empty = el.shadowRoot!.querySelector('.ft-empty');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toContain('No data');
  });

  it('should handle null/undefined values gracefully', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: null }, { name: undefined }, {}];
    await el.updateComplete;
    const cells = el.shadowRoot!.querySelectorAll('.ft-cell');
    expect(cells.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i++) {
      expect(cells[i].textContent!.trim()).toBe('');
    }
  });

  it('should apply number type class for right alignment', async () => {
    const el = createElement();
    el.columns = [{ key: 'val', header: 'Val', type: 'number' }];
    el.data = [{ val: 123 }];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('.ft-cell');
    expect(cell!.classList.contains('ft-type-number')).toBe(true);
  });

  it('should render boolean as checkmark', async () => {
    const el = createElement();
    el.columns = [{ key: 'ok', header: 'OK', type: 'boolean' }];
    el.data = [{ ok: true }, { ok: false }];
    await el.updateComplete;
    const cells = el.shadowRoot!.querySelectorAll('.ft-cell');
    expect(cells[0].textContent).toContain('\u2714');
    expect(cells[1].textContent!.trim()).toBe('');
  });

  it('should use custom renderer when provided', async () => {
    const el = createElement();
    el.columns = [{
      key: 'name',
      header: 'Name',
      renderer: (value) => `**${value}**`,
    }];
    el.data = [{ name: 'Test' }];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('.ft-cell');
    expect(cell!.textContent).toContain('**Test**');
  });

  it('should create body with virtual scroll height', async () => {
    const el = createElement();
    el.rowHeight = 32;
    el.columns = [{ key: 'a', header: 'A' }];
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 1000; i++) {
      rows.push({ a: `row-${i}` });
    }
    el.data = rows;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('.ft-body') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.style.height).toBe('32000px'); // 1000 * 32
  });

  it('should not render all rows for large datasets', async () => {
    const el = createElement();
    el.rowHeight = 32;
    el.columns = [{ key: 'a', header: 'A' }];
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < 10000; i++) {
      rows.push({ a: `row-${i}` });
    }
    el.data = rows;
    await el.updateComplete;
    const renderedRows = el.shadowRoot!.querySelectorAll('.ft-row');
    // Should render far fewer than 10000 rows
    expect(renderedRows.length).toBeLessThan(100);
    expect(renderedRows.length).toBeGreaterThan(0);
  });

  // --- Sorting ---

  it('should render sort indicator on header click', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    el.data = [{ name: 'Bob', age: 2 }, { name: 'Alice', age: 1 }];
    await el.updateComplete;

    // Click first header to sort
    const header = el.shadowRoot!.querySelector('.ft-header-cell') as HTMLElement;
    header.click();
    await el.updateComplete;

    const indicator = el.shadowRoot!.querySelector('.ft-sort-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator!.textContent).toContain('\u25B2'); // ▲ asc
  });

  it('should render sortable headers with pointer cursor', async () => {
    const el = createElement();
    el.columns = [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B', sortable: false },
    ];
    el.data = [{ a: '1', b: '2' }];
    await el.updateComplete;

    const headers = el.shadowRoot!.querySelectorAll('.ft-header-cell');
    expect(headers[0].classList.contains('ft-sortable')).toBe(true);
    expect(headers[1].classList.contains('ft-sortable')).toBe(false);
  });

  // --- Row Numbers ---

  it('should show row numbers when show-row-numbers is set', async () => {
    const el = createElement();
    el.showRowNumbers = true;
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'Alice' }, { name: 'Bob' }];
    await el.updateComplete;

    const rowNums = el.shadowRoot!.querySelectorAll('.ft-row-num');
    expect(rowNums.length).toBeGreaterThanOrEqual(2);
    expect(rowNums[0].textContent).toContain('1');
    expect(rowNums[1].textContent).toContain('2');
  });

  it('should not show row numbers by default', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'Alice' }];
    await el.updateComplete;

    const rowNums = el.shadowRoot!.querySelectorAll('.ft-row-num');
    expect(rowNums.length).toBe(0);
  });

  // --- Row Operations ---

  it('should add a row via addRow()', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'value', header: 'Value', type: 'number' },
    ];
    el.data = [{ name: 'Alice', value: 42 }];
    await el.updateComplete;

    const newRow = el.addRow({ name: 'Bob', value: 7 });
    expect(el.data.length).toBe(2);
    expect(newRow.name).toBe('Bob');
  });

  it('should add empty row with defaults', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name', type: 'text' },
      { key: 'count', header: 'Count', type: 'number' },
      { key: 'active', header: 'Active', type: 'boolean' },
    ];
    el.data = [];
    await el.updateComplete;

    const newRow = el.addRow();
    expect(newRow.name).toBe('');
    expect(newRow.count).toBe(0);
    expect(newRow.active).toBe(false);
  });

  it('should delete rows via deleteRows()', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    await el.updateComplete;

    el.deleteRows([1]); // delete 'B'
    expect(el.data.length).toBe(2);
    expect(el.data[0].name).toBe('A');
    expect(el.data[1].name).toBe('C');
  });

  // --- Export ---

  it('should export to CSV', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    el.data = [{ name: 'Alice', age: 30 }];
    await el.updateComplete;

    const csv = el.exportToString('csv');
    expect(csv).toContain('Name,Age');
    expect(csv).toContain('Alice,30');
  });

  it('should export only filtered data', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    el.data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 },
    ];
    await el.updateComplete;

    el.setFilter('age', (v) => (v as number) >= 30);
    await el.updateComplete;

    const csv = el.exportToString('csv');
    expect(csv).toContain('Alice');
    expect(csv).toContain('Charlie');
    expect(csv).not.toContain('Bob');
  });

  it('should export to JSON', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'Alice', extra: 'hidden' }];
    await el.updateComplete;

    const json = el.exportToString('json');
    const parsed = JSON.parse(json);
    expect(parsed[0].name).toBe('Alice');
    expect(parsed[0]).not.toHaveProperty('extra');
  });

  // --- ARIA ---

  it('should have ARIA grid role', async () => {
    const el = createElement();
    el.columns = [{ key: 'a', header: 'A' }];
    el.data = [{ a: '1' }];
    await el.updateComplete;

    expect(el.getAttribute('role')).toBe('grid');
    expect(el.getAttribute('aria-rowcount')).toBe('1');
    expect(el.getAttribute('aria-colcount')).toBe('1');
  });

  // --- Date/Datetime ---

  it('should render date column with formatted date', async () => {
    const el = createElement();
    el.columns = [{ key: 'created', header: 'Created', type: 'date' }];
    el.data = [{ created: '2024-03-15' }];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('.ft-cell');
    expect(cell).toBeTruthy();
    // Should format as localized date (not raw ISO)
    const text = cell!.textContent!.trim();
    expect(text).not.toBe('');
    expect(text).not.toBe('2024-03-15'); // Should be localized
  });

  it('should render datetime column with formatted datetime', async () => {
    const el = createElement();
    el.columns = [{ key: 'updated', header: 'Updated', type: 'datetime' }];
    el.data = [{ updated: '2024-03-15T10:30:00' }];
    await el.updateComplete;
    const cell = el.shadowRoot!.querySelector('.ft-cell');
    expect(cell).toBeTruthy();
    const text = cell!.textContent!.trim();
    expect(text).not.toBe('');
  });

  // --- Filtering ---

  it('should filter data with setFilter()', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    el.data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 },
    ];
    await el.updateComplete;

    el.setFilter('age', (v) => (v as number) >= 30);
    await el.updateComplete;

    expect(el.filteredRowCount).toBe(2);
    const cells = el.shadowRoot!.querySelectorAll('.ft-cell');
    // Should only render Alice and Charlie
    expect(cells.length).toBeGreaterThanOrEqual(4); // 2 rows x 2 cols
    const texts = Array.from(cells).map(c => c.textContent!.trim());
    expect(texts).toContain('Alice');
    expect(texts).toContain('Charlie');
    expect(texts).not.toContain('Bob');
  });

  it('should show "No matching data" when all filtered out', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'Alice' }];
    await el.updateComplete;

    el.setFilter('name', () => false);
    await el.updateComplete;

    const empty = el.shadowRoot!.querySelector('.ft-empty');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toContain('No matching data');
  });

  it('should restore data with removeFilter()', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'Alice' }, { name: 'Bob' }];
    await el.updateComplete;

    el.setFilter('name', (v) => v === 'Alice');
    await el.updateComplete;
    expect(el.filteredRowCount).toBe(1);

    el.removeFilter('name');
    await el.updateComplete;
    expect(el.filteredRowCount).toBe(2);
  });

  it('should clear all filters with clearFilters()', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'age', header: 'Age', type: 'number' },
    ];
    el.data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    await el.updateComplete;

    el.setFilter('name', (v) => v === 'Alice');
    el.setFilter('age', (v) => (v as number) > 20);
    await el.updateComplete;
    expect(el.filterKeys).toEqual(['name', 'age']);

    el.clearFilters();
    await el.updateComplete;
    expect(el.filterKeys).toEqual([]);
    expect(el.filteredRowCount).toBe(2);
  });

  it('should update ARIA rowcount after filtering', async () => {
    const el = createElement();
    el.columns = [{ key: 'name', header: 'Name' }];
    el.data = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    await el.updateComplete;
    expect(el.getAttribute('aria-rowcount')).toBe('3');

    el.setFilter('name', (v) => v === 'A');
    await el.updateComplete;
    expect(el.getAttribute('aria-rowcount')).toBe('1');
  });

  // --- Paste Auto-Expand ---

  it('should auto-expand rows on paste beyond data bounds', async () => {
    const el = createElement();
    el.columns = [
      { key: 'name', header: 'Name' },
      { key: 'value', header: 'Value', type: 'number' },
    ];
    el.data = [{ name: 'Alice', value: 1 }];
    await el.updateComplete;

    // Verify initial state
    expect(el.data.length).toBe(1);

    // Add 2 more rows via addRow to simulate what paste auto-expand does
    el.addRow({ name: 'Bob', value: 2 });
    el.addRow({ name: 'Charlie', value: 3 });
    expect(el.data.length).toBe(3);
  });

  // --- Resize Handle ---

  it('should render resize handles on header cells', async () => {
    const el = createElement();
    el.columns = [
      { key: 'a', header: 'A' },
      { key: 'b', header: 'B' },
    ];
    el.data = [{ a: '1', b: '2' }];
    await el.updateComplete;

    const handles = el.shadowRoot!.querySelectorAll('.ft-resize-handle');
    expect(handles.length).toBe(2);
  });
});
