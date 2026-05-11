import { describe, it, expect } from 'vitest';
import { migrateRecording } from './migrate.js';

describe('migrateRecording', () => {
  it('upgrades v1 to v2 with empty groups + variables', () => {
    const v1 = {
      version: 1,
      name: 'old',
      createdAt: 't',
      startUrl: '',
      context: 'lightning',
      steps: [],
    };
    const out = migrateRecording(v1);
    expect(out.version).toBe(2);
    expect(out.groups).toEqual([]);
    expect(out.variables).toEqual([]);
  });

  it('passes v2 through, defaulting missing optional fields', () => {
    const v2 = {
      version: 2,
      name: 'new',
      createdAt: 't',
      startUrl: '',
      context: 'lightning',
      steps: [],
    };
    const out = migrateRecording(v2);
    expect(out.version).toBe(2);
    expect(out.groups).toEqual([]);
    expect(out.variables).toEqual([]);
  });

  it('preserves existing groups + variables', () => {
    const v2 = {
      version: 2,
      name: 'flow',
      createdAt: 't',
      startUrl: '',
      context: 'lightning',
      steps: [],
      groups: [{ id: 'g1', name: 'login' }],
      variables: ['ACCOUNT_NAME'],
    };
    const out = migrateRecording(v2);
    expect(out.groups).toEqual([{ id: 'g1', name: 'login' }]);
    expect(out.variables).toEqual(['ACCOUNT_NAME']);
  });

  it('rejects unknown versions', () => {
    expect(() =>
      migrateRecording({ version: 99, name: 'x', createdAt: 't', startUrl: '', context: 'lightning', steps: [] }),
    ).toThrow(/Unsupported recording version/);
  });

  it('rejects missing version', () => {
    expect(() => migrateRecording({} as unknown)).toThrow(/missing.*version/);
  });
});
