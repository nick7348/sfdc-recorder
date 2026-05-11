import { describe, it, expect, beforeEach } from 'vitest';
import { detectFieldType, isPopoverField } from './fieldType.js';

describe('detectFieldType', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('detects native text input as text', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(detectFieldType(el)).toBe('text');
  });

  it('detects native checkbox as checkbox', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    expect(detectFieldType(el)).toBe('checkbox');
  });

  it('detects native date input', () => {
    const el = document.createElement('input');
    el.type = 'date';
    expect(detectFieldType(el)).toBe('date');
  });

  it('detects native select as picklist', () => {
    const el = document.createElement('select');
    expect(detectFieldType(el)).toBe('picklist');
  });

  it('detects multi-select as multipicklist', () => {
    const el = document.createElement('select');
    el.multiple = true;
    expect(detectFieldType(el)).toBe('multipicklist');
  });

  it('detects role=combobox as picklist by default', () => {
    document.body.innerHTML = `<button role="combobox">Type</button>`;
    const el = document.querySelector('button')!;
    expect(detectFieldType(el)).toBe('picklist');
  });

  it('detects lightning-combobox via wrapper', () => {
    document.body.innerHTML = `<lightning-combobox><button>Pick</button></lightning-combobox>`;
    const el = document.querySelector('button')!;
    expect(detectFieldType(el)).toBe('combobox');
  });
});

describe('isPopoverField', () => {
  it('identifies popover-style fields', () => {
    expect(isPopoverField('picklist')).toBe(true);
    expect(isPopoverField('multipicklist')).toBe(true);
    expect(isPopoverField('lookup')).toBe(true);
    expect(isPopoverField('combobox')).toBe(true);
  });
  it('rejects plain inputs', () => {
    expect(isPopoverField('text')).toBe(false);
    expect(isPopoverField('checkbox')).toBe(false);
    expect(isPopoverField('date')).toBe(false);
  });
});
