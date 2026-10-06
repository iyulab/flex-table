/// <reference types="@vitest/browser-playwright" />
import { cdp } from 'vitest/browser';

/**
 * What assistive technology receives — read from Chromium's own accessibility tree over CDP, not from
 * the DOM. Role, `aria-*` and focus asserted on elements say what we *wrote*; this says what the
 * browser *exposes*, after shadow-DOM boundaries, `aria-activedescendant` resolution and name
 * computation. It still does not say what a given screen reader *speaks*.
 */
export interface AxNode {
  role: string;
  name: string;
  props: Record<string, unknown>;
}

interface RawAxNode {
  nodeId: string;
  ignored?: boolean;
  role?: { value: string };
  name?: { value: string };
  backendDOMNodeId?: number;
  properties?: { name: string; value: { value: unknown; relatedNodes?: { backendDOMNodeId: number }[] } }[];
}

const toNode = (n: RawAxNode): AxNode => ({
  role: n.role?.value ?? '',
  name: n.name?.value ?? '',
  props: Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value])),
});

/** The accessibility tree of the frame this test runs in (the CDP session is attached to the top page). */
export async function axTree(): Promise<RawAxNode[]> {
  const session = cdp();
  await session.send('Accessibility.enable');
  const { frameTree } = (await session.send('Page.getFrameTree')) as { frameTree: FrameTree };
  const frameId = findFrame(frameTree, location.href);
  const { nodes } = (await session.send('Accessibility.getFullAXTree', frameId ? { frameId } : {})) as { nodes: RawAxNode[] };
  return nodes;
}

interface FrameTree { frame: { id: string; url: string }; childFrames?: FrameTree[] }
function findFrame(tree: FrameTree, url: string): string | undefined {
  if (tree.frame.url === url) return tree.frame.id;
  for (const child of tree.childFrames ?? []) {
    const id = findFrame(child, url);
    if (id) return id;
  }
  return undefined;
}

/**
 * The node a screen reader treats as current: the focused node, or — when the focused node points
 * at another with `aria-activedescendant` — that node. `null` when nothing in the frame has focus.
 */
export async function axActive(): Promise<AxNode | null> {
  const nodes = await axTree();
  // The document itself reports `focused` whenever the frame has focus — the current node is the focused one below it.
  const focused = nodes.find(
    (n) => !n.ignored && !/WebArea$/.test(n.role?.value ?? '') && n.properties?.some((p) => p.name === 'focused' && p.value.value === true),
  );
  if (!focused) return null;
  const desc = focused.properties?.find((p) => p.name === 'activedescendant')?.value.relatedNodes?.[0];
  if (desc) {
    const target = nodes.find((n) => n.backendDOMNodeId === desc.backendDOMNodeId);
    if (target) return toNode(target);
  }
  return toNode(focused);
}

/** The first non-ignored node with this role. */
export async function axFirst(role: string): Promise<AxNode | null> {
  const n = (await axTree()).find((x) => !x.ignored && x.role?.value === role);
  return n ? toNode(n) : null;
}
