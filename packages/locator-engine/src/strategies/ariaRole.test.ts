import { describe, it, expect } from 'vitest';
import { buildAriaRoleLocator } from './ariaRole.js';

describe('buildAriaRoleLocator', () => {
  it('builds role+name for a button with text', () => {
    document.body.innerHTML = `<button>Save</button>`;
    const el = document.querySelector('button')!;
    const result = buildAriaRoleLocator(el);
    expect(result?.kind).toBe('ariaRole');
    expect(result?.confidence).toBe(0.85);
    expect(result?.playwright).toBe('getByRole("button", { name: "Save" })');
  });

  it('treats an explicit role attribute as authoritative', () => {
    document.body.innerHTML = `<div role="checkbox" aria-label="Agree"></div>`;
    const el = document.querySelector('div')!;
    const result = buildAriaRoleLocator(el);
    expect(result?.playwright).toBe('getByRole("checkbox", { name: "Agree" })');
  });

  it('handles an LWC <lightning-button> as a button role', () => {
    document.body.innerHTML = `<lightning-button>New</lightning-button>`;
    const el = document.querySelector('lightning-button')!;
    const result = buildAriaRoleLocator(el);
    expect(result?.playwright).toBe('getByRole("button", { name: "New" })');
  });

  it('infers role=textbox for plain inputs', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.setAttribute('aria-label', 'Email');
    const result = buildAriaRoleLocator(el);
    expect(result?.playwright).toBe('getByRole("textbox", { name: "Email" })');
  });

  it('infers role=button for input[type=submit]', () => {
    const el = document.createElement('input');
    el.type = 'submit';
    el.value = 'Send';
    const result = buildAriaRoleLocator(el);
    expect(result?.playwright).toBe('getByRole("button", { name: "Send" })');
  });

  it('falls back to a name-less role when no accessible name exists', () => {
    const el = document.createElement('button');
    const result = buildAriaRoleLocator(el);
    expect(result?.playwright).toBe('getByRole("button")');
    expect(result?.confidence).toBe(0.5);
  });

  it('returns null for elements with no role at all', () => {
    const el = document.createElement('span');
    expect(buildAriaRoleLocator(el)).toBeNull();
  });
});
