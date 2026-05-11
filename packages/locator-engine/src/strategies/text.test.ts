import { describe, it, expect } from 'vitest';
import { buildTextLocator, buildPlaceholderLocator } from './text.js';

describe('buildTextLocator', () => {
  it('uses direct text content', () => {
    document.body.innerHTML = `<a>Save</a>`;
    const el = document.querySelector('a')!;
    const result = buildTextLocator(el);
    expect(result?.playwright).toBe('getByText("Save", { exact: true })');
    expect(result?.confidence).toBe(0.6);
  });

  it('returns null when text is too long (>120 chars)', () => {
    const el = document.createElement('div');
    el.textContent = 'x'.repeat(200);
    expect(buildTextLocator(el)).toBeNull();
  });

  it('returns null when text comes only from descendants', () => {
    document.body.innerHTML = `<div><span>only descendant text</span></div>`;
    const el = document.querySelector('div')!;
    expect(buildTextLocator(el)).toBeNull();
  });

  it('returns null for empty or whitespace-only text', () => {
    const el = document.createElement('span');
    el.textContent = '   \n  ';
    expect(buildTextLocator(el)).toBeNull();
  });
});

describe('buildPlaceholderLocator', () => {
  it('uses placeholder attribute', () => {
    const el = document.createElement('input');
    el.setAttribute('placeholder', 'Search...');
    const result = buildPlaceholderLocator(el);
    expect(result?.playwright).toBe('getByPlaceholder("Search...")');
    expect(result?.confidence).toBe(0.7);
  });

  it('returns null when placeholder is missing or blank', () => {
    const el = document.createElement('input');
    expect(buildPlaceholderLocator(el)).toBeNull();
    el.setAttribute('placeholder', '   ');
    expect(buildPlaceholderLocator(el)).toBeNull();
  });
});
