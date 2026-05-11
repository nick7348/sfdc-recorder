import type { LocatorCandidate } from '../types.js';

/**
 * Build a `getByText` locator. Less stable than role/label (text is shown
 * to the user and can be re-worded by admins/translations), but better
 * than raw CSS for things like links and clickable spans.
 */
export function buildTextLocator(el: Element): LocatorCandidate | null {
  const raw = el.textContent?.trim();
  if (!raw || raw.length > 120) return null;

  // Skip elements with only descendant text — text matching them is too noisy.
  const directText = Array.from(el.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? '')
    .join('')
    .trim();
  if (!directText) return null;

  return {
    kind: 'text',
    playwright: `getByText(${JSON.stringify(directText)}, { exact: true })`,
    confidence: 0.6,
    description: `visible text "${directText}"`,
  };
}

export function buildPlaceholderLocator(el: Element): LocatorCandidate | null {
  const placeholder = el.getAttribute('placeholder')?.trim();
  if (!placeholder) return null;

  return {
    kind: 'placeholder',
    playwright: `getByPlaceholder(${JSON.stringify(placeholder)})`,
    confidence: 0.7,
    description: `placeholder="${placeholder}"`,
  };
}
