import { describe, it, expect } from 'vitest';
import { buildTestIdLocator } from './testId.js';

describe('buildTestIdLocator', () => {
  it('returns a getByTestId locator for data-testid', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'save-button');
    const result = buildTestIdLocator(el);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('testId');
    expect(result?.confidence).toBe(1.0);
    expect(result?.playwright).toBe('getByTestId("save-button")');
  });

  it('also recognises data-test, data-qa, data-cy, data-id', () => {
    for (const attr of ['data-test', 'data-qa', 'data-cy', 'data-id']) {
      const el = document.createElement('div');
      el.setAttribute(attr, `value-${attr}`);
      const result = buildTestIdLocator(el);
      expect(result, `attr=${attr}`).not.toBeNull();
      expect(result?.kind).toBe('testId');
    }
  });

  it('returns null for elements without any test id attribute', () => {
    const el = document.createElement('div');
    expect(buildTestIdLocator(el)).toBeNull();
  });

  it('ignores Salesforce internal aura attributes (which are unstable)', () => {
    const el = document.createElement('div');
    el.setAttribute('data-aura-rendered-by', '42:abc');
    expect(buildTestIdLocator(el)).toBeNull();
  });

  it('escapes quotes in attribute values', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'has "quotes"');
    const result = buildTestIdLocator(el);
    expect(result?.raw).toContain('\\"');
  });
});
