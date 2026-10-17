import { html, nothing } from 'lit';
import { t } from '../locale.js';
import { editableNumber } from '../clipboard/clipboard.js';
// The from/to bounds are `u-date-picker`s (registers the tag).
import '@iyulab/components/dist/components/date-picker/UDatePicker.js';
import { parseNumber } from '@iyulab/components/dist/utilities/format.js';
import { filterModelPredicate } from '../core/filter-model.js';
import { calendarOpen } from '../core/calendar-state.js';
import type { FilterModel, NumericOp, TextFilterMode } from '../core/filter-model.js';
import type { FilterPredicate } from '../core/filtering.js';
import type { CompositionTracker } from '@iyulab/components/dist/utilities/composition.js';
import type { ColumnDefinition } from '../models/types.js';

/** What the filter popover needs from the table — the controller owns the popover's state and controls, the table owns the filters. */
export interface FilterPopoverContext {
  /** Puts a filter in place and recomputes — the popover already holds the state it built the model from. */
  commit(key: string, predicate: FilterPredicate, model?: FilterModel): void;
  /** Removes the filter of a column. */
  remove(key: string): void;
  /** Closes the popover; focus goes back to what opened it unless told not to. */
  close(restoreFocus?: boolean): void;
  /** Tracks IME composition in the popover's text field. */
  ime: CompositionTracker;
}

/** `text` is what the person typed — kept so a re-render never rewrites a half-typed `1,` to `1`. */
interface NumCondition { op: NumericOp; value: number | null; text?: string }
interface NumberAdvState { cond1: NumCondition; join: 'and' | 'or'; cond2: NumCondition }

const NUM_OP_LABELS: Record<NumericOp, string> = {
  eq: '=', neq: '≠', gt: '>', lt: '<', gte: '≥', lte: '≤',
};

/** The column filter popover: one control set per column type, and the per-column state those controls hold. */
export class FilterPopoverController {
  readonly textState: Map<string, { value: string; mode: TextFilterMode }> = new Map();
  readonly numberState: Map<string, NumberAdvState> = new Map();
  readonly dateState: Map<string, { from?: string; to?: string }> = new Map();
  readonly emptyState: Map<string, 'empty' | 'non-empty'> = new Map();

  constructor(private readonly ctx: FilterPopoverContext) {}

  /**
   * Tab stays inside the filter dialog (it floats over the table, fixed to the header — a focus that left
   * it would leave it open and unreachable behind the next control). Capture phase: the controls stop
   * their own keydowns from reaching the grid.
   */
  private onDialogKeydown(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const dialog = e.currentTarget as HTMLElement;
    const stops = [...dialog.querySelectorAll<HTMLElement>('input, select, textarea, button, u-date-picker')]
      .filter((el) => !(el as HTMLInputElement).disabled && el.getClientRects().length > 0);
    if (stops.length === 0) return;
    const path = e.composedPath();
    const at = stops.findIndex((el) => path.includes(el));
    const last = stops.length - 1;
    if (e.shiftKey && at <= 0) {
      e.preventDefault();
      stops[last].focus();
    } else if (!e.shiftKey && (at === last || at === -1)) {
      e.preventDefault();
      stops[0].focus();
    }
  }

  renderDropdown(col: ColumnDefinition) {
    const type = col.type ?? 'text';

    return html`
      <div class="ft-filter-dropdown" role="dialog" aria-label=${t('filterFor', { header: col.label })}
        @click=${(e: MouseEvent) => e.stopPropagation()}
        @keydown=${{ handleEvent: (e: KeyboardEvent) => this.onDialogKeydown(e), capture: true }}>
        ${type === 'boolean' ? this.renderBooleanFilter(col)
          : type === 'number' ? this.renderNumberFilter(col)
          : type === 'date' || type === 'datetime' ? this.renderDateFilter(col)
          : this.renderTextFilter(col)}
        <div class="ft-filter-actions">
          <button class="ft-filter-clear" @click=${() => this.clearColumn(col.key)}>${t('clear')}</button>
        </div>
      </div>
    `;
  }

  private renderEmptyRow(key: string, onChangeExtra?: () => void) {
    const current = this.emptyState.get(key) ?? '';
    return html`
      <div class="ft-filter-empty-row">
        <label>${t('blankCells')}</label>
        <select class="ft-filter-mode-select" aria-label=${t('blankCells')}
          .value=${current}
          @change=${(e: Event) => {
            const val = (e.target as HTMLSelectElement).value as 'empty' | 'non-empty' | '';
            if (val === '' || val === 'empty' || val === 'non-empty') {
              if (val) {
                this.emptyState.set(key, val);
              } else {
                this.emptyState.delete(key);
              }
              onChangeExtra?.();
              this.applyFor(key);
            }
          }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
          <option value="">${t('blankAll')}</option>
          <option value="empty">${t('emptyOnly')}</option>
          <option value="non-empty">${t('nonEmptyOnly')}</option>
        </select>
      </div>
    `;
  }

  /** The number popover's state as a model — conditions without a value are not conditions. */
  private numberModel(state: NumberAdvState): FilterModel | null {
    const conditions = [state.cond1, state.cond2]
      .filter((c): c is NumCondition & { value: number } => c.value != null)
      .map(c => ({ op: c.op, value: c.value }));
    if (conditions.length === 0) return null;
    return conditions.length === 2 ? { type: 'number', conditions, join: state.join } : { type: 'number', conditions };
  }

  private dateModel(state: { from?: string; to?: string }): FilterModel | null {
    if (state.from == null && state.to == null) return null;
    return { type: 'date', ...(state.from != null ? { from: state.from } : {}), ...(state.to != null ? { to: state.to } : {}) };
  }

  /** The popover state of one column as a model — blank-cell choice first, then whichever control holds a value. */
  private modelFromState(key: string): FilterModel | null {
    const emptyVal = this.emptyState.get(key);
    if (emptyVal) return { type: 'empty', empty: emptyVal };
    const text = this.textState.get(key);
    if (text) return text.value ? { type: 'text', mode: text.mode, value: text.value } : null;
    const number = this.numberState.get(key);
    if (number) return this.numberModel(number);
    const date = this.dateState.get(key);
    if (date) return this.dateModel(date);
    return null;
  }

  /** Puts a model into the popover state, so opening the popover shows what is filtering. */
  syncState(key: string, model: FilterModel): void {
    this.clearState(key);
    switch (model.type) {
      case 'text': this.textState.set(key, { value: model.value, mode: model.mode }); break;
      case 'number': {
        const [first, second] = model.conditions;
        const state = this.defaultNumState();
        state.cond1 = { op: first.op, value: first.value };
        if (second) {
          state.cond2 = { op: second.op, value: second.value };
          state.join = model.join ?? 'and';
        }
        this.numberState.set(key, state);
        break;
      }
      case 'date': this.dateState.set(key, { from: model.from, to: model.to }); break;
      case 'empty': this.emptyState.set(key, model.empty); break;
      default: break; // boolean · equals — no popover state to show
    }
  }

  clearState(key: string): void {
    this.textState.delete(key);
    this.numberState.delete(key);
    this.dateState.delete(key);
    this.emptyState.delete(key);
  }

  private applyFor(key: string): void {
    const model = this.modelFromState(key);
    if (model) this.ctx.commit(key, filterModelPredicate(model), model);
    else this.ctx.remove(key);
  }

  private renderTextFilter(col: ColumnDefinition) {
    const state = this.textState.get(col.key) ?? { value: '', mode: 'contains' as TextFilterMode };
    return html`
      <div class="ft-filter-mode-row">
        <select class="ft-filter-mode-select" aria-label=${t('filterMatchMode')}
          .value=${state.mode}
          @change=${(e: Event) => {
            const mode = (e.target as HTMLSelectElement).value as TextFilterMode;
            const cur = this.textState.get(col.key) ?? { value: '', mode: 'contains' as TextFilterMode };
            this.textState.set(col.key, { ...cur, mode });
            this.applyFor(col.key);
          }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
          <option value="contains">${t('contains')}</option>
          <option value="starts">${t('startsWith')}</option>
          <option value="ends">${t('endsWith')}</option>
          <option value="wildcard">${t('wildcard')}</option>
        </select>
      </div>
      <input class="ft-filter-input" type="text" placeholder=${t('searchPlaceholder')} aria-label=${t('filterText')}
        .value=${state.value}
        @compositionstart=${this.ctx.ime}
        @compositionupdate=${this.ctx.ime}
        @compositionend=${this.ctx.ime}
        @input=${(e: InputEvent) => {
          const value = (e.target as HTMLInputElement).value;
          const cur = this.textState.get(col.key) ?? { value: '', mode: 'contains' as TextFilterMode };
          this.textState.set(col.key, { ...cur, value });
          if (this.ctx.ime.composing) return;
          // Text input clears empty filter (mutually exclusive)
          this.emptyState.delete(col.key);
          this.applyFor(col.key);
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Escape') this.ctx.close();
          e.stopPropagation();
        }}>
      ${this.renderEmptyRow(col.key, () => {
        // When empty filter is set, clear the text state
        this.textState.delete(col.key);
      })}
    `;
  }

  private defaultNumState(): NumberAdvState {
    return { cond1: { op: 'gte', value: null }, join: 'and', cond2: { op: 'lte', value: null } };
  }

  private renderNumCondRow(key: string, which: 'cond1' | 'cond2') {
    const state = this.numberState.get(key) ?? this.defaultNumState();
    const cond = state[which];
    return html`
      <div class="ft-num-cond-row">
        <select class="ft-filter-mode-select ft-num-op-select" aria-label=${t('conditionOperator', { n: which === 'cond1' ? 1 : 2 })}
          .value=${cond.op}
          @change=${(e: Event) => {
            const op = (e.target as HTMLSelectElement).value as NumericOp;
            const cur = this.numberState.get(key) ?? this.defaultNumState();
            cur[which] = { ...cur[which], op };
            this.numberState.set(key, cur);
            this.emptyState.delete(key);
            this.applyFor(key);
          }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
          ${(Object.keys(NUM_OP_LABELS) as NumericOp[]).map(op =>
            html`<option value=${op}>${NUM_OP_LABELS[op]}</option>`)}
        </select>
        <input class="ft-filter-input ft-num-cond-input" type="text" inputmode="decimal" placeholder=${t('valuePlaceholder')}
          aria-label=${t('conditionValue', { n: which === 'cond1' ? 1 : 2 })}
          .value=${cond.text ?? (cond.value != null ? editableNumber(cond.value) : '')}
          aria-invalid=${cond.text && cond.value == null ? 'true' : 'false'}
          @input=${(e: InputEvent) => {
            const raw = (e.target as HTMLInputElement).value;
            const cur = this.numberState.get(key) ?? this.defaultNumState();
            cur[which] = { ...cur[which], text: raw, value: raw.trim() === '' ? null : parseNumber(raw) };
            this.numberState.set(key, cur);
            this.emptyState.delete(key);
            this.applyFor(key);
          }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
      </div>
    `;
  }

  private renderNumberFilter(col: ColumnDefinition) {
    const state = this.numberState.get(col.key) ?? this.defaultNumState();
    return html`
      ${this.renderNumCondRow(col.key, 'cond1')}
      <div class="ft-filter-mode-row">
        <select class="ft-filter-mode-select" aria-label=${t('conditionJoin')}
          .value=${state.join}
          @change=${(e: Event) => {
            const join = (e.target as HTMLSelectElement).value as 'and' | 'or';
            const cur = this.numberState.get(col.key) ?? this.defaultNumState();
            cur.join = join;
            this.numberState.set(col.key, cur);
            this.emptyState.delete(col.key);
            this.applyFor(col.key);
          }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
      </div>
      ${this.renderNumCondRow(col.key, 'cond2')}
      ${this.renderEmptyRow(col.key, () => {
        this.numberState.delete(col.key);
      })}
    `;
  }

  /**
   * From/to bounds as two `u-date-picker`s — the cell editor's control, for the same reason: the native
   * date inputs show the browser's UI language (`10/02/2026` in an English browser) while the table
   * shows ISO. Two pickers, not one `u-date-range-picker`: either bound may be left open ("from this
   * day on"), which a range value cannot say. Each bound's calendar stops at the other bound.
   */
  private renderDateFilter(col: ColumnDefinition) {
    const datetime = col.type === 'datetime';
    const state = this.dateState.get(col.key) ?? {};
    const day = (v: string | undefined) => v?.slice(0, 10);
    const onKeyDown = (e: KeyboardEvent) => {
      // Escape while a calendar is open closes that calendar, not the filter — the overlay layer that
      // closes it listens on the document, so that one key is let through.
      if (e.key === 'Escape' && calendarOpen(e.currentTarget as Element)) return;
      e.stopPropagation();
      if (e.key === 'Escape') this.ctx.close();
    };
    return html`
      <div class="ft-filter-range ft-filter-range-dates">
        <u-date-picker class="ft-filter-date" size="sm" clearable
          mode=${datetime ? 'datetime' : 'date'} label=${t('fromPlaceholder')}
          .value=${state.from ?? ''} max=${day(state.to) ?? nothing}
          @change=${(e: Event) => this.applyDateFilter(col.key, e, 'from')}
          @keydown=${onKeyDown}></u-date-picker>
        <u-date-picker class="ft-filter-date" size="sm" clearable
          mode=${datetime ? 'datetime' : 'date'} label=${t('toPlaceholder')}
          .value=${state.to ?? ''} min=${day(state.from) ?? nothing}
          @change=${(e: Event) => this.applyDateFilter(col.key, e, 'to')}
          @keydown=${onKeyDown}></u-date-picker>
      </div>
      ${this.renderEmptyRow(col.key, () => {
        this.dateState.delete(col.key);
      })}
    `;
  }

  private applyDateFilter(key: string, e: Event, bound: 'from' | 'to'): void {
    const value = (e.target as HTMLElement & { value?: string }).value ?? '';
    const state = this.dateState.get(key) ?? {};
    if (value === '') {
      delete state[bound];
    } else {
      state[bound] = value;
    }
    this.dateState.set(key, state);
    // Clear empty filter when type-specific filter is applied
    this.emptyState.delete(key);
    this.applyFor(key);
  }

  private renderBooleanFilter(col: ColumnDefinition) {
    return html`
      <select class="ft-filter-input" aria-label=${t('filterFor', { header: col.label })}
        @change=${(e: Event) => {
          const value = (e.target as HTMLSelectElement).value;
          if (value === 'all') {
            this.ctx.remove(col.key);
          } else {
            this.ctx.commit(col.key, (v) => Boolean(v) === (value === 'true'), { type: 'boolean', value: value === 'true' });
          }
        }}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Escape') this.ctx.close(); e.stopPropagation(); }}>
        <option value="all">${t('all')}</option>
        <option value="true">\u2714 ${t('booleanTrue')}</option>
        <option value="false">\u2718 ${t('booleanFalse')}</option>
      </select>
      ${this.renderEmptyRow(col.key)}
    `;
  }

  clearColumn(key: string): void {
    this.ctx.remove(key);
    this.clearState(key);
    this.ctx.close(false);
  }
}
