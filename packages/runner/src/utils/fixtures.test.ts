import { describe, it, expect } from 'vitest';
import { applyFixtures, findUsedVariables, findUnresolvedVariables } from './fixtures.js';

describe('applyFixtures', () => {
  it('substitutes $VAR placeholders', () => {
    expect(applyFixtures('Acme $SUFFIX', { SUFFIX: 'Co' })).toBe('Acme Co');
  });

  it('substitutes ${VAR} placeholders', () => {
    expect(applyFixtures('${USER}@${DOMAIN}', { USER: 'n', DOMAIN: 'x' })).toBe('n@x');
  });

  it('leaves unresolved variables intact', () => {
    expect(applyFixtures('Hello $UNKNOWN', { OTHER: 'x' })).toBe('Hello $UNKNOWN');
  });

  it('returns input unchanged when no fixtures provided', () => {
    expect(applyFixtures('Hello $X', undefined)).toBe('Hello $X');
    expect(applyFixtures('Hello $X', {})).toBe('Hello $X');
  });

  it('does not match lowercase or mixed-case names', () => {
    expect(applyFixtures('Hello $name', { name: 'x' })).toBe('Hello $name');
    expect(applyFixtures('Hello $Name', { Name: 'x' })).toBe('Hello $Name');
  });
});

describe('findUsedVariables', () => {
  it('returns unique variable names', () => {
    expect(findUsedVariables('$A and $B and $A')).toEqual(['A', 'B']);
  });
  it('returns empty array when no vars', () => {
    expect(findUsedVariables('plain text')).toEqual([]);
  });
});

describe('findUnresolvedVariables', () => {
  it('returns vars missing from fixtures', () => {
    expect(findUnresolvedVariables('$A $B', { A: '1' })).toEqual(['B']);
  });
  it('returns all vars when fixtures undefined', () => {
    expect(findUnresolvedVariables('$A $B', undefined)).toEqual(['A', 'B']);
  });
});
