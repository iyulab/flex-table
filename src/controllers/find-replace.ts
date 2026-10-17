import { html } from 'lit';
import { t } from '../locale.js';
import { isImeComposing } from '@iyulab/components/dist/utilities/keyboard.js';
import type { CompositionTracker } from '@iyulab/components/dist/utilities/composition.js';
import { getCellValue, setCellValue } from '../core/cell-value.js';
import type { FlexTableEventMap } from '../events.js';
import type { ColumnDefinition, DataRow } from '../models/types.js';

/** What the find panel needs from the table — the controller owns the panel's state, the table owns everything else. */
export interface FindReplaceContext {
  /** The visible columns, in display order. */
  columns(): ColumnDefinition[];
  /** Rows on show (after filter and sort, before paging). */
  rowCount(): number;
  /** Data index of a visual row. */
  dataIndex(visualRow: number): number;
  data(): DataRow[];
  isEditable(col: ColumnDefinition, row: DataRow | undefined): boolean;
  /** Puts an undoable step on the table's stack and tells listeners the undo state moved. */
  pushUndo(step: { label: string; undo: () => void; redo: () => void }): void;
  emitReplace(detail: FlexTableEventMap['find-replace']['detail']): void;
  /** Makes (row, col) the active cell and scrolls it into view. */
  reveal(row: number, col: number): void;
  invalidate(): void;
  focusInput(): void;
  /** Tracks IME composition in the panel's text fields. */
  ime: CompositionTracker;
}

export interface FindState {
  mode: 'find' | 'replace';
  query: string;
  replaceWith: string;
  matchCase: boolean;
  wholeCell: boolean;
  results: Array<{ row: number; col: number }>;
  currentIndex: number;
}

/** Find / replace over the visible cells — the panel's state, the search, the replace steps and the panel's template. */
export class FindReplaceController {
  state: FindState | null = null;

  constructor(private readonly ctx: FindReplaceContext) {}

  toggle(mode: 'find' | 'replace'): void {
    if (this.state?.mode === mode) {
      this.close();
      return;
    }
    this.open(mode);
  }

  open(mode: 'find' | 'replace'): void {
    this.state = {
      mode,
      query: this.state?.query ?? '',
      replaceWith: this.state?.replaceWith ?? '',
      matchCase: false,
      wholeCell: false,
      results: [],
      currentIndex: 0,
    };
    if (this.state.query) this.search();
    this.ctx.invalidate();
    requestAnimationFrame(() => this.ctx.focusInput());
  }

  close(): void {
    this.state = null;
    this.ctx.invalidate();
  }

  search(): void {
    if (!this.state) return;
    const { query, matchCase, wholeCell } = this.state;
    if (!query) {
      this.state.results = [];
      this.state.currentIndex = 0;
      this.ctx.invalidate();
      return;
    }

    const needle = matchCase ? query : query.toLowerCase();
    const cols = this.ctx.columns();
    const results: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < this.ctx.rowCount(); r++) {
      const dataRow = this.ctx.dataIndex(r);
      for (let c = 0; c < cols.length; c++) {
        const cellVal = String(this.ctx.data()[dataRow][cols[c].key] ?? '');
        const haystack = matchCase ? cellVal : cellVal.toLowerCase();
        const hit = wholeCell ? haystack === needle : haystack.includes(needle);
        if (hit) results.push({ row: r, col: c });
      }
    }

    this.state.results = results;
    this.state.currentIndex = 0;
    this.ctx.invalidate();
  }

  goTo(index: number): void {
    if (!this.state || this.state.results.length === 0) return;
    const count = this.state.results.length;
    this.state.currentIndex = ((index % count) + count) % count;
    const { row, col } = this.state.results[this.state.currentIndex];
    this.ctx.reveal(row, col);
    this.ctx.invalidate();
  }

  next(): void {
    if (!this.state) return;
    this.goTo(this.state.currentIndex + 1);
  }

  prev(): void {
    if (!this.state) return;
    this.goTo(this.state.currentIndex - 1);
  }

  replaceAll(): void {
    if (!this.state || this.state.results.length === 0) return;
    const { results, replaceWith } = this.state;
    const cols = this.ctx.columns();
    const saved: Array<{ dataRow: number; key: string; oldValue: unknown; newValue: unknown }> = [];
    const targets: DataRow[] = [];

    for (const { row, col } of results) {
      const dataRow = this.ctx.dataIndex(row);
      if (!this.ctx.isEditable(cols[col], this.ctx.data()[dataRow])) continue;
      const key = cols[col].key;
      const oldValue = getCellValue(this.ctx.data()[dataRow], key);
      setCellValue(this.ctx.data()[dataRow], key, replaceWith);
      saved.push({ dataRow, key, oldValue, newValue: replaceWith });
      targets.push(this.ctx.data()[dataRow]);
    }

    if (saved.length > 0) {
      this.ctx.pushUndo({
        label: 'replace-all',
        undo: () => { saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.oldValue); }); this.ctx.invalidate(); },
        redo: () => { saved.forEach((s, i) => { setCellValue(targets[i], s.key, s.newValue); }); this.ctx.invalidate(); },
      });
      this.ctx.emitReplace({ type: 'replace-all', cells: saved.map(s => ({ row: s.dataRow, col: s.key, oldValue: s.oldValue, newValue: s.newValue })) });
    }

    this.state.results = [];
    this.state.currentIndex = 0;
    this.ctx.invalidate();
  }

  replaceOne(): void {
    if (!this.state || this.state.results.length === 0) return;
    const { currentIndex, results, replaceWith } = this.state;
    const { row, col } = results[currentIndex];
    const dataRow = this.ctx.dataIndex(row);
    const key = this.ctx.columns()[col].key;
    const target = this.ctx.data()[dataRow];
    // A match in a cell that may not change is found, not replaced — move on to the next one.
    if (!this.ctx.isEditable(this.ctx.columns()[col], target)) {
      this.next();
      return;
    }
    const oldValue = getCellValue(target, key);
    setCellValue(target, key, replaceWith);

    this.ctx.pushUndo({
      label: 'replace',
      undo: () => { setCellValue(target, key, oldValue); this.ctx.invalidate(); },
      redo: () => { setCellValue(target, key, replaceWith); this.ctx.invalidate(); },
    });
    this.ctx.emitReplace({ type: 'replace', cells: [{ row: dataRow, col: key, oldValue, newValue: replaceWith }] });

    this.search();
    this.goTo(Math.min(currentIndex, this.state.results.length - 1));
  }

  render() {
    if (!this.state) return '';
    const { mode, query, replaceWith, matchCase, wholeCell, results, currentIndex } = this.state;
    const count = results.length;
    const current = count > 0 ? currentIndex + 1 : 0;

    return html`
      <div class="ft-find-panel"
        @keydown=${(e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Escape') { this.close(); return; }
          if (e.key === 'Enter' && !isImeComposing(e) && e.target instanceof HTMLInputElement && e.target.classList.contains('ft-find-input')) {
            e.shiftKey ? this.prev() : this.next();
          }
        }}>
        <div class="ft-find-row">
          <input class="ft-find-input" type="text" placeholder=${t('findPlaceholder')} aria-label=${t('findInput')}
            .value=${query}
            @compositionstart=${this.ctx.ime}
            @compositionupdate=${this.ctx.ime}
            @compositionend=${this.ctx.ime}
            @input=${(e: Event) => {
              this.state!.query = (e.target as HTMLInputElement).value;
              if (this.ctx.ime.composing) return;
              this.search();
            }}>
          <span class="ft-find-count">${count > 0 ? `${current}/${count}` : query ? t('findNoResults') : ''}</span>
          <!-- 글리프는 이름이 아니다(«◀» 는 «black left-pointing triangle» 로 읽힌다) — 이름은 aria-label, 키는 aria-keyshortcuts -->
          <button @click=${() => this.prev()} aria-label=${t('findPrevious')} aria-keyshortcuts="Shift+Enter" title=${`${t('findPrevious')} (Shift+Enter)`}>◀</button>
          <button @click=${() => this.next()} aria-label=${t('findNext')} aria-keyshortcuts="Enter" title=${`${t('findNext')} (Enter)`}>▶</button>
          <label title=${t('matchCase')}><input type="checkbox" aria-label=${t('matchCase')} ?checked=${matchCase} @change=${(e: Event) => { this.state!.matchCase = (e.target as HTMLInputElement).checked; this.search(); }}> Aa</label>
          <label title=${t('wholeCell')}><input type="checkbox" aria-label=${t('wholeCell')} ?checked=${wholeCell} @change=${(e: Event) => { this.state!.wholeCell = (e.target as HTMLInputElement).checked; this.search(); }}> [ ]</label>
          <button @click=${() => this.close()} aria-label=${t('closeFind')} aria-keyshortcuts="Escape" title=${`${t('closeFind')} (Escape)`}>✕</button>
        </div>
        ${mode === 'replace' ? html`
          <div class="ft-find-row">
            <input class="ft-find-replace-input" type="text" placeholder=${t('replaceWithPlaceholder')} aria-label=${t('replaceInput')}
              .value=${replaceWith}
              @input=${(e: Event) => { this.state!.replaceWith = (e.target as HTMLInputElement).value; }}>
            <button @click=${() => this.replaceOne()} ?disabled=${count === 0}>${t('replace')}</button>
            <button @click=${() => this.replaceAll()} ?disabled=${count === 0}>${t('replaceAll')}</button>
          </div>
        ` : ''}
      </div>
    `;
  }

}
