import type { LocatorCandidate } from '../types.js';

/**
 * Build a relative XPath fallback. Used as a last resort because XPath
 * indices in Salesforce shift constantly. We deliberately avoid absolute
 * indexed paths and instead anchor on the nearest element with semantic
 * attributes (data-*, aria-label, role).
 */
export function buildRelativeXPath(el: Element): LocatorCandidate | null {
  const segments: string[] = [];
  let current: Element | null = el;
  let anchored = false;

  while (current && segments.length < 6) {
    const seg = describeForXPath(current);
    segments.unshift(seg.text);
    if (seg.anchored) {
      anchored = true;
      break;
    }
    current = current.parentElement;
  }

  if (!anchored) {
    // No semantic anchor found — emit but with very low confidence.
    return {
      kind: 'relativeXPath',
      playwright: `locator(${JSON.stringify('xpath=//' + segments.join('/'))})`,
      raw: '//' + segments.join('/'),
      confidence: 0.15,
      description: 'unanchored relative XPath (low stability)',
    };
  }

  const xpath = '//' + segments.join('/');
  return {
    kind: 'relativeXPath',
    playwright: `locator(${JSON.stringify('xpath=' + xpath)})`,
    raw: xpath,
    confidence: 0.3,
    description: `relative XPath anchored on semantic ancestor`,
  };
}

function describeForXPath(el: Element): { text: string; anchored: boolean } {
  const tag = el.tagName.toLowerCase();

  for (const attr of ['data-testid', 'data-test', 'data-qa', 'aria-label', 'name']) {
    const v = el.getAttribute(attr);
    if (v) {
      return {
        text: `${tag}[@${attr}=${JSON.stringify(v)}]`,
        anchored: true,
      };
    }
  }

  const role = el.getAttribute('role');
  if (role) {
    return { text: `${tag}[@role=${JSON.stringify(role)}]`, anchored: true };
  }

  return { text: tag, anchored: false };
}
