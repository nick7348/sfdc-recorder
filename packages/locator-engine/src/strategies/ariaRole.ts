import type { LocatorCandidate } from '../types.js';

/**
 * Build a `getByRole(role, { name })` locator. Salesforce buttons, links,
 * and combobox controls almost always have correct ARIA semantics, making
 * this a stable second-best after testId.
 */
export function buildAriaRoleLocator(el: Element): LocatorCandidate | null {
  const role = computeImplicitRole(el) ?? el.getAttribute('role');
  if (!role) return null;

  const name = computeAccessibleName(el);
  if (!name) {
    return {
      kind: 'ariaRole',
      playwright: `getByRole(${JSON.stringify(role)})`,
      confidence: 0.5,
      description: `role=${role} (no accessible name)`,
    };
  }

  return {
    kind: 'ariaRole',
    playwright: `getByRole(${JSON.stringify(role)}, { name: ${JSON.stringify(name)} })`,
    confidence: 0.85,
    description: `role=${role} name="${name}"`,
  };
}

const IMPLICIT_ROLES: Record<string, string> = {
  a: 'link',
  button: 'button',
  input: 'textbox',
  textarea: 'textbox',
  select: 'combobox',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  // Common Salesforce LWC tags expose the same roles as their native counterparts:
  'lightning-button': 'button',
  'lightning-button-icon': 'button',
  'lightning-input': 'textbox',
  'lightning-combobox': 'combobox',
};

function computeImplicitRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    return 'textbox';
  }
  return IMPLICIT_ROLES[tag] ?? null;
}

function computeAccessibleName(el: Element): string | null {
  const aria = el.getAttribute('aria-label')?.trim();
  if (aria) return aria;

  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const root = el.getRootNode() as Document | ShadowRoot;
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => root.querySelector?.(`#${id}`)?.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (labels) return labels;
  }

  const text = el.textContent?.trim();
  if (text && text.length <= 80) return text;

  const title = el.getAttribute('title')?.trim();
  if (title) return title;

  const value = (el as HTMLInputElement).value;
  if (value && el.tagName === 'INPUT') return value;

  return null;
}
