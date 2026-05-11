import type { Recording } from './types.js';

/**
 * Migrate a recording from v1 to the current (v2) schema.
 * v2 adds optional fields (groups, variables) and new step kinds.
 * v1 recordings remain valid — we just stamp the version and ensure new
 * optional containers exist as empty arrays for downstream tooling.
 */
export function migrateRecording(rec: unknown): Recording {
  if (!rec || typeof rec !== 'object') {
    throw new Error('Recording is not an object');
  }
  const r = rec as Recording;

  if (r.version === undefined) {
    throw new Error('Recording missing `version` field');
  }
  if (r.version !== 1 && r.version !== 2) {
    throw new Error(`Unsupported recording version: ${r.version}`);
  }

  if (r.version === 1) {
    return {
      ...r,
      version: 2,
      groups: [],
      variables: [],
    };
  }
  return {
    ...r,
    groups: r.groups ?? [],
    variables: r.variables ?? [],
  };
}
