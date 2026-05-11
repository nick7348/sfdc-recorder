import type { LocatorCandidate } from '../types.js';
import { deepClosest } from '../shadowDom.js';

/**
 * For form fields (`input`, `textarea`, `select`, `lightning-input`, etc.),
 * resolve the visible label and use Playwright's `getByLabel`.
 *
 * Salesforce Lightning patterns we handle:
 *  - `<label for="id"><input id="id"/>` (standard)
 *  - `<lightning-input label="Name"/>` (LWC attribute)
 *  - `<label>Name<input/></label>` (wrapping)
 *  - Slot-projected labels inside shadow roots
 */
const LABELABLE_TAGS = new Set([
  'input',
  'textarea',
  'select',
  'lightning-input',
  'lightning-textarea',
  'lightning-combobox',
  'lightning-input-field',
]);

export function buildLabelLocator(el: Element): LocatorCandidate | null {
  const tag = el.tagName.toLowerCase();
  if (!LABELABLE_TAGS.has(tag)) return null;

  const label = resolveLabelText(el);
  if (!label) return null;

  return {
    kind: 'label',
    playwright: `getByLabel(${JSON.stringify(label)}, { exact: true })`,
    confidence: 0.9,
    description: `field labelled "${label}"`,
  };
}

function resolveLabelText(el: Element): string | null {
  const direct = el.getAttribute('label') ?? el.getAttribute('aria-label');
  if (direct?.trim()) return direct.trim();

  const id = el.id;
  if (id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const lbl = root.querySelector?.(`label[for="${cssEscape(id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }

  const wrapping = deepClosest(el, 'label');
  if (wrapping) {
    const text = Array.from(wrapping.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    if (text) return text;
  }

  return null;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
