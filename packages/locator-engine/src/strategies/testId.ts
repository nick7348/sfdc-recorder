import type { LocatorCandidate } from '../types.js';

/**
 * Look for stable test/data attributes set by developers.
 * Salesforce internal attrs (e.g. `data-aura-rendered-by`) are NOT stable —
 * they're auto-generated per-render and excluded.
 */
const STABLE_ATTRS = ['data-testid', 'data-test', 'data-qa', 'data-cy', 'data-id'] as const;

export function buildTestIdLocator(el: Element): LocatorCandidate | null {
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (val && val.trim()) {
      return {
        kind: 'testId',
        playwright: `getByTestId(${JSON.stringify(val)})`,
        raw: `[${attr}="${val.replace(/"/g, '\\"')}"]`,
        confidence: 1.0,
        description: `data attribute ${attr}="${val}"`,
      };
    }
  }
  return null;
}
