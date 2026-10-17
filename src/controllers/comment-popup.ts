import { html, nothing, type TemplateResult } from 'lit';
import { t } from '../locale.js';

/** What the comment popup needs from the table — the controller owns the popup, the table owns the comments. */
export interface CommentPopupContext {
  /** The table's shadow root — where the popup's textarea is looked up. */
  root(): ShadowRoot | null;
  getComment(dataIndex: number, colKey: string): string | null;
  /** `null` removes the comment. */
  setComment(dataIndex: number, colKey: string, text: string | null): void;
  invalidate(): void;
}

interface CommentPopup {
  dataIndex: number;
  colKey: string;
  x: number;
  y: number;
}

/** The small editor a cell's comment opens in: Ctrl/Cmd+Enter or a click outside saves, Escape cancels. */
export class CommentPopupController {
  private popup: CommentPopup | null = null;
  /** Set when the popup opens; the next render fills and focuses its textarea. */
  private needsInit = false;

  constructor(private readonly ctx: CommentPopupContext) {}

  /** The open popup's target, or `null` when it is closed. */
  get current(): CommentPopup | null {
    return this.popup;
  }

  open(dataIndex: number, colKey: string, x: number, y: number): void {
    this.popup = { dataIndex, colKey, x, y };
    this.needsInit = true;
    this.ctx.invalidate();
    requestAnimationFrame(() => {
      document.addEventListener('mousedown', this.onOutsideClick);
    });
  }

  /** Saves the text (an empty text removes the comment) and closes. */
  commit(): void {
    if (!this.popup) return;
    document.removeEventListener('mousedown', this.onOutsideClick);
    const ta = this.ctx.root()?.querySelector('.ft-comment-popup textarea') as HTMLTextAreaElement | null;
    const newText = ta?.value?.trim() || null;
    const existing = this.ctx.getComment(this.popup.dataIndex, this.popup.colKey);
    if (newText !== existing) {
      this.ctx.setComment(this.popup.dataIndex, this.popup.colKey, newText);
    }
    this.close();
  }

  cancel(): void {
    if (!this.popup) return;
    document.removeEventListener('mousedown', this.onOutsideClick);
    this.close();
  }

  /** Drops the document listener — the table calls it when it leaves the page. */
  dispose(): void {
    document.removeEventListener('mousedown', this.onOutsideClick);
  }

  /** Called after the table renders: the freshly opened popup's textarea takes the comment and the focus. */
  afterRender(): void {
    if (!this.needsInit || !this.popup) return;
    const ta = this.ctx.root()?.querySelector('.ft-comment-popup textarea') as HTMLTextAreaElement | null;
    if (!ta) return;
    this.needsInit = false;
    ta.value = this.ctx.getComment(this.popup.dataIndex, this.popup.colKey) ?? '';
    ta.focus();
    ta.select();
  }

  render(): TemplateResult | typeof nothing {
    if (!this.popup) return nothing;
    const { x, y } = this.popup;

    const popupW = 240;
    const popupH = 150;
    const adjustedX = x + popupW > window.innerWidth ? x - popupW : x;
    const adjustedY = y + popupH > window.innerHeight ? y - popupH : y;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); this.cancel(); }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.commit(); }
    };

    return html`
      <div class="ft-comment-popup"
        style="position: fixed; left: ${adjustedX}px; top: ${adjustedY}px; z-index: calc(var(--u-layer-floating, 1000) + 1);"
        @mousedown=${(e: MouseEvent) => e.stopPropagation()}>
        <textarea class="ft-comment-popup-textarea" aria-label=${t('addComment')}
          rows="4"
          placeholder=${t('addCommentPlaceholder')}
          @keydown=${onKeyDown}></textarea>
        <div class="ft-comment-popup-buttons">
          <button class="ft-comment-popup-cancel" @click=${() => this.cancel()}>${t('cancel')}</button>
          <button class="ft-comment-popup-save" @click=${() => this.commit()}>${t('save')}</button>
        </div>
      </div>
    `;
  }

  private close(): void {
    this.popup = null;
    this.needsInit = false;
    this.ctx.invalidate();
  }

  private readonly onOutsideClick = () => {
    this.commit();
  };
}
