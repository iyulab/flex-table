/// <reference types="@vitest/browser-playwright" />
import { cdp } from 'vitest/browser';
import { axTree } from './ax.js';

/**
 * Where a screen reader would say «clickable» for no reason — read from what the browser actually holds, not
 * from source. A `click`, `mousedown` or `mouseup` listener on an element makes Chromium expose it as
 * clickable, and NVDA (measured, 2026.2, browse mode) announces it on that element and on entering it — every
 * `u-button` read as «clickable, button». Only these roles are spared: they already say what a press does.
 */
export const SPARED_ROLES = new Set(['button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'option', 'radio', 'checkbox', 'switch']);
const TYPES = new Set(['click', 'mousedown', 'mouseup']);

interface DomNode {
  nodeId: number;
  backendNodeId: number;
  nodeType: number;
  nodeName: string;
  localName?: string;
  attributes?: string[];
  documentURL?: string;
  children?: DomNode[];
  shadowRoots?: DomNode[];
  contentDocument?: DomNode;
}

export interface Noise {
  element: string;
  role: string;
  types: string[];
}

const SCOPE = 'data-clickable-scope';

function walk(node: DomNode, visit: (n: DomNode) => void) {
  visit(node);
  for (const r of node.shadowRoots ?? []) walk(r, visit);
  for (const c of node.children ?? []) walk(c, visit);
  if (node.contentDocument) walk(node.contentDocument, visit);
}

function attr(n: DomNode, name: string): string | undefined {
  const a = n.attributes ?? [];
  for (let i = 0; i < a.length; i += 2) if (a[i] === name) return a[i + 1];
  return undefined;
}

function describe(n: DomNode): string {
  const cls = attr(n, 'class');
  const part = attr(n, 'part');
  return `${n.localName}${cls ? `.${cls.trim().split(/\s+/).join('.')}` : ''}${part ? `[part=${part}]` : ''}`;
}

/** Elements under `scope` (its shadow trees included) that carry a click-type listener but no role that spares it. */
export async function clickableNoise(scope: Element): Promise<Noise[]> {
  scope.setAttribute(SCOPE, '');
  try {
    const session = cdp();
    const { root } = (await session.send('DOM.getDocument', { depth: -1, pierce: true })) as { root: DomNode };
    let scopeNode: DomNode | undefined;
    walk(root, (n) => {
      if (!scopeNode && n.nodeType === 1 && attr(n, SCOPE) !== undefined) scopeNode = n;
    });
    if (!scopeNode) throw new Error('clickableNoise: scope element not found over CDP');

    const ax = new Map<number, { ignored: boolean; role: string }>();
    for (const n of await axTree()) {
      if (n.backendDOMNodeId !== undefined) ax.set(n.backendDOMNodeId, { ignored: !!n.ignored, role: n.role?.value ?? '' });
    }

    const elements: DomNode[] = [];
    walk(scopeNode, (n) => { if (n.nodeType === 1) elements.push(n); });

    const noise: Noise[] = [];
    for (const n of elements) {
      const { object } = (await session.send('DOM.resolveNode', { backendNodeId: n.backendNodeId })) as { object: { objectId: string } };
      const { listeners } = (await session.send('DOMDebugger.getEventListeners', { objectId: object.objectId })) as { listeners: { type: string }[] };
      await session.send('Runtime.releaseObject', { objectId: object.objectId });
      const types = [...new Set(listeners.map((l) => l.type).filter((t) => TYPES.has(t)))];
      if (!types.length) continue;
      const a = ax.get(n.backendNodeId);
      if (!a || a.ignored || SPARED_ROLES.has(a.role)) continue;
      noise.push({ element: describe(n), role: a.role, types });
    }
    return noise;
  } finally {
    scope.removeAttribute(SCOPE);
  }
}
