/**
 * Salesforce field-type detection.
 *
 * The recorder uses this to tag interactions so the runner picks the right
 * strategy (e.g. picklists need a click-to-open + click-option flow rather
 * than a plain `.fill()`).
 */

export type SalesforceFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'toggle'
  | 'picklist'
  | 'multipicklist'
  | 'lookup'
  | 'combobox'
  | 'unknown';

import { deepClosest } from './shadowDom.js';

/**
 * Classify the field type based on tag, ARIA hints, and surrounding LWC tags.
 * The element passed should be the actual interactive control (input, button,
 * combobox), not its outer LWC wrapper.
 */
export function detectFieldType(el: Element): SalesforceFieldType {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const type = (el as HTMLInputElement).type?.toLowerCase();

  // Walk up to the nearest LWC wrapper for stronger signal.
  const lwcWrapper = findLwcWrapper(el);
  const wrapperTag = lwcWrapper?.tagName?.toLowerCase();

  if (wrapperTag === 'lightning-input-field' || wrapperTag === 'lightning-input') {
    const dataType = lwcWrapper?.getAttribute('data-output-element-id')
      ? null
      : lwcWrapper?.getAttribute('type');
    if (dataType === 'checkbox') return 'checkbox';
    if (dataType === 'date') return 'date';
    if (dataType === 'datetime' || dataType === 'datetime-local') return 'datetime';
    if (dataType === 'number') return 'number';
    if (dataType === 'toggle') return 'toggle';
  }

  if (wrapperTag === 'lightning-combobox') return 'combobox';
  if (wrapperTag === 'lightning-textarea' || tag === 'textarea') return 'textarea';
  if (wrapperTag === 'lightning-lookup' || isLightningLookup(el)) return 'lookup';

  // Picklist detection: native select, or button/combobox role inside
  // lightning-base-combobox (used by picklists, multi-picklists).
  if (tag === 'select') {
    return (el as HTMLSelectElement).multiple ? 'multipicklist' : 'picklist';
  }

  if (role === 'combobox' || role === 'listbox') {
    if (deepClosest(el, '[multiple], lightning-dual-listbox')) return 'multipicklist';
    return 'picklist';
  }

  // Plain inputs by type.
  if (tag === 'input') {
    if (type === 'checkbox') return 'checkbox';
    if (type === 'date') return 'date';
    if (type === 'datetime-local') return 'datetime';
    if (type === 'number') return 'number';
    return 'text';
  }

  return 'unknown';
}

function findLwcWrapper(el: Element): Element | null {
  return deepClosest(
    el,
    'lightning-input-field, lightning-input, lightning-combobox, lightning-textarea, lightning-lookup, lightning-dual-listbox, lightning-checkbox-group, lightning-radio-group, lightning-datepicker, lightning-datetimepicker',
  );
}

function isLightningLookup(el: Element): boolean {
  // Lookup fields are a button + popover; the element clicked is often
  // a button inside `force-lookup` or has data-* hints.
  const hints = ['force-lookup', 'lightning-grouped-combobox'];
  return Boolean(deepClosest(el, hints.join(', ')));
}

/**
 * Whether the recorder should treat this interaction as "open + select" vs
 * "type into input". Determines which RecordedAction subtype we emit.
 */
export function isPopoverField(t: SalesforceFieldType): boolean {
  return t === 'picklist' || t === 'multipicklist' || t === 'lookup' || t === 'combobox';
}
