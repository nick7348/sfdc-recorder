import type { SalesforceContext } from './types.js';

/**
 * Detect whether the current document is Salesforce Lightning, Classic, or non-Salesforce.
 *
 * Heuristics:
 *  - Lightning: any element with `[data-aura-rendered-by]` OR a `<lightning-*>` web component
 *  - Classic: legacy `body#bodyTag` + `force.com` URL but no Lightning markers
 */
export function detectSalesforceContext(doc: Document = document): SalesforceContext {
  if (
    doc.querySelector('[data-aura-rendered-by]') ||
    doc.querySelector('[class*="slds-"]') ||
    /lightning-[a-z]/i.test(doc.body?.innerHTML?.slice(0, 5000) ?? '')
  ) {
    return 'lightning';
  }

  const url = doc.location?.href ?? '';
  const looksLikeSalesforceHost = /\.(force|salesforce|visualforce)\.com/i.test(url);
  if (looksLikeSalesforceHost && doc.querySelector('body#bodyTag')) {
    return 'classic';
  }

  return 'unknown';
}
