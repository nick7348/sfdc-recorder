/**
 * Utilities for traversing Lightning's nested Shadow DOM trees.
 *
 * Lightning Web Components (LWC) put nearly every interactive element behind
 * a closed-ish shadow root. Native `document.querySelector` cannot pierce
 * shadow roots, so the recorder must walk them explicitly.
 */

/**
 * Compose the path of shadow-host tag names from `document` down to `el`.
 * The runner uses this in generated tests as a sequence of `>>` separators
 * for Playwright's shadow-aware engine.
 */
export function getShadowPath(el: Element): string[] {
  const path: string[] = [];
  let current: Node = el;

  for (;;) {
    const root: Node = current.getRootNode();
    if (!(root instanceof ShadowRoot)) break;
    const host: Element = root.host;
    path.unshift(host.tagName.toLowerCase());
    current = host;
  }
  return path;
}

/**
 * Deep query that pierces shadow roots. Returns the first match anywhere
 * in the open shadow tree under `root`.
 */
export function deepQuerySelector(root: Document | ShadowRoot | Element, selector: string): Element | null {
  const direct = root.querySelector(selector);
  if (direct) return direct;

  const candidates = root.querySelectorAll('*');
  for (const el of candidates) {
    const sr = (el as Element & { shadowRoot?: ShadowRoot }).shadowRoot;
    if (sr) {
      const found = deepQuerySelector(sr, selector);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Walks up the DOM **and** shadow tree to find the closest ancestor matching `selector`.
 * Native `Element.closest` does not traverse out of shadow roots.
 */
export function deepClosest(el: Element, selector: string): Element | null {
  let current: Element | null = el;
  while (current) {
    if (current.matches?.(selector)) return current;
    const parent: Node | null = current.parentNode;
    if (parent instanceof ShadowRoot) {
      current = parent.host;
    } else if (parent instanceof Element) {
      current = parent;
    } else {
      current = null;
    }
  }
  return null;
}
