/**
 * The mechanics the column menu and the cell context menu share, kept apart from what the menus hold
 * and do (that stays on the table): the menu keyboard pattern, keeping a menu on screen, and the
 * menu key's repeated `contextmenu`.
 */

/** What a key does inside an open menu. */
export type MenuKeyAction =
  | { kind: 'focus'; index: number }
  | { kind: 'escape' }
  | { kind: 'tab' };

/**
 * The menu keyboard pattern: arrows and Home / End move between the items (the arrows wrap), Escape closes and
 * returns focus, Tab closes. `current` is the focused item's index (`-1` when focus is not on an item).
 * `null` for any other key.
 */
export function menuKeyAction(key: string, current: number, count: number): MenuKeyAction | null {
  switch (key) {
    case 'ArrowDown': return { kind: 'focus', index: current < 0 ? 0 : (current + 1) % count };
    case 'ArrowUp': return { kind: 'focus', index: current <= 0 ? count - 1 : current - 1 };
    case 'Home': return { kind: 'focus', index: 0 };
    case 'End': return { kind: 'focus', index: count - 1 };
    case 'Escape': return { kind: 'escape' };
    case 'Tab': return { kind: 'tab' };
    default: return null;
  }
}

/**
 * Where to move a menu so it stays inside the visible area (not the window: its width includes the
 * scrollbar, and a menu fitted to that ends under it). Only the sides that overflow are returned.
 */
export function menuShift(
  rect: { right: number; bottom: number; width: number; height: number },
  view: { width: number; height: number },
  margin = 4,
): { left?: number; top?: number } {
  const shift: { left?: number; top?: number } = {};
  if (rect.right > view.width - margin) shift.left = Math.max(margin, view.width - rect.width - margin);
  if (rect.bottom > view.height - margin) shift.top = Math.max(margin, view.height - rect.height - margin);
  return shift;
}

/**
 * The menu key (and Shift+F10) opens a menu from its `keydown`; Chromium then fires its own `contextmenu` once
 * more when the key is released. The table arms this when it takes the key and drops that one repeat.
 */
export class KeyMenuGuard {
  private until = 0;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** The menu key opened a menu: the next real `contextmenu` within a second is its echo. */
  arm(): void {
    this.until = this.now() + 1000;
  }

  /** Whether `contextmenu` event `e` is that echo (consumed once). Synthetic events are never dropped. */
  swallow(e: { isTrusted: boolean }): boolean {
    if (e.isTrusted && this.now() < this.until) {
      this.until = 0;
      return true;
    }
    return false;
  }
}
