import { describe, it, expect } from 'vitest';
import { buildLabelLocator } from './label.js';

describe('buildLabelLocator', () => {
  it('uses the `label` attribute on a lightning-input', () => {
    const el = document.createElement('lightning-input');
    el.setAttribute('label', 'Account Name');
    const result = buildLabelLocator(el);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe('label');
    expect(result?.confidence).toBe(0.9);
    expect(result?.playwright).toBe('getByLabel("Account Name", { exact: true })');
  });

  it('falls back to aria-label when no `label` attr is present', () => {
    const el = document.createElement('lightning-input');
    el.setAttribute('aria-label', 'Search');
    const result = buildLabelLocator(el);
    expect(result?.playwright).toBe('getByLabel("Search", { exact: true })');
  });

  it('resolves <label for="id"> pairs', () => {
    document.body.innerHTML = `
      <label for="acc-name">Account Name</label>
      <input id="acc-name" />
    `;
    const input = document.getElementById('acc-name')!;
    const result = buildLabelLocator(input);
    expect(result?.playwright).toBe('getByLabel("Account Name", { exact: true })');
  });

  it('resolves wrapping <label> with text content', () => {
    document.body.innerHTML = `
      <label>Type<input /></label>
    `;
    const input = document.querySelector('input')!;
    const result = buildLabelLocator(input);
    expect(result?.playwright).toBe('getByLabel("Type", { exact: true })');
  });

  it('returns null for non-labelable tags', () => {
    const el = document.createElement('div');
    el.setAttribute('label', 'Ignored');
    expect(buildLabelLocator(el)).toBeNull();
  });

  it('returns null when no label can be resolved', () => {
    const el = document.createElement('input');
    expect(buildLabelLocator(el)).toBeNull();
  });
});
