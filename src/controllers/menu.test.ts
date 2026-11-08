import { describe, it, expect } from 'vitest';
import { KeyMenuGuard, menuKeyAction, menuShift } from './menu.js';

describe('menuKeyAction', () => {
  it('ArrowDown goes to the next item and wraps; from outside the items it goes to the first', () => {
    expect(menuKeyAction('ArrowDown', 0, 3)).toEqual({ kind: 'focus', index: 1 });
    expect(menuKeyAction('ArrowDown', 2, 3)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKeyAction('ArrowDown', -1, 3)).toEqual({ kind: 'focus', index: 0 });
  });

  it('ArrowUp goes to the previous item and wraps; from the first or from outside it goes to the last', () => {
    expect(menuKeyAction('ArrowUp', 2, 3)).toEqual({ kind: 'focus', index: 1 });
    expect(menuKeyAction('ArrowUp', 0, 3)).toEqual({ kind: 'focus', index: 2 });
    expect(menuKeyAction('ArrowUp', -1, 3)).toEqual({ kind: 'focus', index: 2 });
  });

  it('Home and End go to the ends', () => {
    expect(menuKeyAction('Home', 2, 4)).toEqual({ kind: 'focus', index: 0 });
    expect(menuKeyAction('End', 1, 4)).toEqual({ kind: 'focus', index: 3 });
  });

  it('Escape closes and returns focus, Tab closes and lets focus move on, anything else is not the menu\'s', () => {
    expect(menuKeyAction('Escape', 1, 3)).toEqual({ kind: 'escape' });
    expect(menuKeyAction('Tab', 1, 3)).toEqual({ kind: 'tab' });
    expect(menuKeyAction('a', 1, 3)).toBeNull();
    expect(menuKeyAction('Enter', 1, 3)).toBeNull();
  });
});

describe('menuShift', () => {
  const view = { width: 1000, height: 800 };

  it('leaves a menu that fits alone', () => {
    expect(menuShift({ right: 400, bottom: 300, width: 200, height: 250 }, view)).toEqual({});
  });

  it('moves a menu past the right edge back inside, keeping the margin', () => {
    expect(menuShift({ right: 1100, bottom: 300, width: 200, height: 250 }, view)).toEqual({ left: 796 });
  });

  it('moves a menu past the bottom edge up, and handles both at once', () => {
    expect(menuShift({ right: 400, bottom: 900, width: 200, height: 250 }, view)).toEqual({ top: 546 });
    expect(menuShift({ right: 1100, bottom: 900, width: 200, height: 250 }, view)).toEqual({ left: 796, top: 546 });
  });

  it('never goes past the near edge when the menu is larger than the view', () => {
    expect(menuShift({ right: 1100, bottom: 900, width: 2000, height: 2000 }, view)).toEqual({ left: 4, top: 4 });
  });

  it('counts a menu within the margin of the edge as overflowing', () => {
    expect(menuShift({ right: 998, bottom: 300, width: 200, height: 250 }, view)).toEqual({ left: 796 });
  });
});

describe('KeyMenuGuard', () => {
  it('drops the one real contextmenu that echoes the menu key, within a second', () => {
    let now = 5000;
    const guard = new KeyMenuGuard(() => now);
    guard.arm();
    now += 400;
    expect(guard.swallow({ isTrusted: true })).toBe(true);
    expect(guard.swallow({ isTrusted: true })).toBe(false);
  });

  it('lets an echo that comes too late through, and never drops a synthetic event', () => {
    let now = 5000;
    const guard = new KeyMenuGuard(() => now);
    guard.arm();
    expect(guard.swallow({ isTrusted: false })).toBe(false);
    now += 1500;
    expect(guard.swallow({ isTrusted: true })).toBe(false);
  });

  it('drops nothing when it was never armed', () => {
    const guard = new KeyMenuGuard(() => 100);
    expect(guard.swallow({ isTrusted: true })).toBe(false);
  });
});
