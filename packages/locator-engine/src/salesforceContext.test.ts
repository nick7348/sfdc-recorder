import { describe, it, expect, beforeEach } from 'vitest';
import { detectSalesforceContext } from './salesforceContext.js';

describe('detectSalesforceContext', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  it('detects lightning via [data-aura-rendered-by]', () => {
    document.body.innerHTML = `<div data-aura-rendered-by="42:abc"></div>`;
    expect(detectSalesforceContext()).toBe('lightning');
  });

  it('detects lightning via slds class', () => {
    document.body.innerHTML = `<div class="slds-button"></div>`;
    expect(detectSalesforceContext()).toBe('lightning');
  });

  it('returns unknown for non-Salesforce pages', () => {
    document.body.innerHTML = `<p>Hello</p>`;
    expect(detectSalesforceContext()).toBe('unknown');
  });
});
