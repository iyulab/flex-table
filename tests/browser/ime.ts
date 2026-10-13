/// <reference types="@vitest/browser-playwright" />
import { cdp } from 'vitest/browser';

/**
 * Real IME composition, driven through Chromium's own input pipeline over CDP — not synthetic events. The browser
 * produces the whole sequence a composing user produces: `compositionstart` / `compositionupdate`, `beforeinput` and
 * `input` with `isComposing: true`, the field's live value, and `compositionend`. A `KeyboardEvent` built by hand
 * carries whatever flags the test wrote; this carries what the browser does.
 *
 * The composition goes to the focused element, so focus the field (inside its shadow root if it has one) first.
 * One call to `compose` is one syllable block as a two-set Korean keyboard builds it — typing «서울» is
 * `compose(['ㅅ', '서', '성'])`, then `ㅜ` moves the final consonant: `commit('서')`, `compose(['우', '울'])`,
 * `commit('울')`.
 *
 * Safari's commit key (`keyCode: 229` with `isComposing: false`, after `compositionend`) cannot be produced by
 * Chromium — keep a synthetic stand-in for it.
 */
export async function compose(steps: string[]): Promise<void> {
  const session = cdp();
  for (const text of steps) {
    await session.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  }
}

/** Ends the active composition with `text` in place — what a space, a click elsewhere or the next block does. */
export async function commit(text: string): Promise<void> {
  await cdp().send('Input.insertText', { text });
}

/**
 * Ends the active composition by pressing Enter. Chromium sends `keydown` Enter with `keyCode: 229` and
 * `isComposing: true` first, then commits (`compositionend`), then `keyup` Enter with `keyCode: 13` — the order a
 * Windows or macOS Chrome user produces.
 */
export async function commitWithEnter(text: string): Promise<void> {
  const session = cdp();
  await session.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 229, nativeVirtualKeyCode: 229,
  });
  await session.send('Input.insertText', { text });
  await session.send('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
  });
}
