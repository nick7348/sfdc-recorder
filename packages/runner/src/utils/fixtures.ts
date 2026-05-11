import { readFile } from 'node:fs/promises';

/**
 * Substitute `$VAR_NAME` and `${VAR_NAME}` placeholders in a string with
 * values from a fixture map. Missing variables are left as-is and surfaced
 * via `findUnresolvedVariables` so the caller can fail fast.
 *
 * Examples:
 *   applyFixtures("Acme $SUFFIX", { SUFFIX: "Co" }) === "Acme Co"
 *   applyFixtures("${USER}@${DOMAIN}", { USER: "n", DOMAIN: "x" }) === "n@x"
 */
const VAR_RE = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;

export function applyFixtures(input: string, fixtures: Record<string, string> | undefined): string {
  if (!fixtures || Object.keys(fixtures).length === 0) return input;
  return input.replace(VAR_RE, (match, name: string) => fixtures[name] ?? match);
}

export function findUsedVariables(input: string): string[] {
  const matches = new Set<string>();
  for (const m of input.matchAll(VAR_RE)) {
    if (m[1]) matches.add(m[1]);
  }
  return [...matches];
}

export function findUnresolvedVariables(
  input: string,
  fixtures: Record<string, string> | undefined,
): string[] {
  const used = findUsedVariables(input);
  if (!fixtures) return used;
  return used.filter((v) => !(v in fixtures));
}

export async function loadFixtures(path: string): Promise<Record<string, string>> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Fixture file must be a JSON object: ${path}`);
  }
  // Coerce all values to string for safety; the recorder only stores strings.
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    out[k] = String(v);
  }
  return out;
}
