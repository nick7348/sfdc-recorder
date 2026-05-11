import type { FrameLocator, Locator, Page } from '@playwright/test';
import type { ElementSnapshot, LocatorCandidate } from '@sfdc-recorder/locator-engine';
import { resolveFrame } from '../utils/frames.js';

export interface ResolveOptions {
  /** Per-candidate timeout in ms. Kept short so falling back is cheap. */
  perCandidateTimeoutMs?: number;
  /** Require the resolved element to be visible. */
  requireVisible?: boolean;
}

export interface ResolvedLocator {
  locator: Locator;
  candidate: LocatorCandidate;
  fallbackIndex: number;
  attempts: number;
  /** Frame scope used (top page or a FrameLocator). */
  scope: Page | FrameLocator;
}

/**
 * Walk a snapshot's candidate list and return the first candidate that
 * resolves to a real, visible element on `page` (drilling into recorded
 * iframes if any).
 */
export async function resolveLocator(
  page: Page,
  snapshot: ElementSnapshot,
  options: ResolveOptions = {},
): Promise<ResolvedLocator> {
  const perTimeout = options.perCandidateTimeoutMs ?? 2_500;
  const requireVisible = options.requireVisible ?? true;

  if (snapshot.candidates.length === 0) {
    throw new Error('Snapshot has no locator candidates');
  }

  const scope = resolveFrame(page, snapshot.framePath);
  const errors: Array<{ candidate: LocatorCandidate; reason: string }> = [];

  for (let i = 0; i < snapshot.candidates.length; i++) {
    const candidate = snapshot.candidates[i]!;
    const locator = compileToLocator(scope, candidate);

    try {
      if (requireVisible) {
        await locator.waitFor({ state: 'visible', timeout: perTimeout });
      } else {
        await locator.waitFor({ state: 'attached', timeout: perTimeout });
      }
      const count = await locator.count();
      const resolved = count > 1 ? locator.first() : locator;

      return { locator: resolved, candidate, fallbackIndex: i, attempts: i + 1, scope };
    } catch (err) {
      errors.push({
        candidate,
        reason: err instanceof Error ? err.message.split('\n')[0] ?? '' : String(err),
      });
      continue;
    }
  }

  const summary = errors
    .map((e) => `  - ${e.candidate.kind} (${e.candidate.description}): ${e.reason}`)
    .join('\n');
  throw new Error(`No locator candidate matched. Tried ${errors.length}:\n${summary}`);
}

/**
 * Translate a recorded `LocatorCandidate.playwright` string into a real
 * Locator on the given scope (page or frame). Whitelisted constructors only.
 */
export function compileToLocator(scope: Page | FrameLocator, candidate: LocatorCandidate): Locator {
  const expr = candidate.playwright.trim();

  const roleMatch = /^getByRole\(\s*("[^"]*"|'[^']*')\s*(?:,\s*(\{.*\}))?\s*\)$/s.exec(expr);
  if (roleMatch) {
    const role = unquote(roleMatch[1]!);
    const opts = roleMatch[2] ? safeJsonish(roleMatch[2]) : undefined;
    return scope.getByRole(role as Parameters<Page['getByRole']>[0], opts);
  }

  const labelMatch = /^getByLabel\(\s*("[^"]*"|'[^']*')\s*(?:,\s*(\{.*\}))?\s*\)$/s.exec(expr);
  if (labelMatch) {
    return scope.getByLabel(unquote(labelMatch[1]!), labelMatch[2] ? safeJsonish(labelMatch[2]) : undefined);
  }

  const textMatch = /^getByText\(\s*("[^"]*"|'[^']*')\s*(?:,\s*(\{.*\}))?\s*\)$/s.exec(expr);
  if (textMatch) {
    return scope.getByText(unquote(textMatch[1]!), textMatch[2] ? safeJsonish(textMatch[2]) : undefined);
  }

  const phMatch = /^getByPlaceholder\(\s*("[^"]*"|'[^']*')\s*\)$/s.exec(expr);
  if (phMatch) return scope.getByPlaceholder(unquote(phMatch[1]!));

  const tidMatch = /^getByTestId\(\s*("[^"]*"|'[^']*')\s*\)$/s.exec(expr);
  if (tidMatch) return scope.getByTestId(unquote(tidMatch[1]!));

  const locMatch = /^locator\(\s*("[^"]*"|'[^']*')\s*\)$/s.exec(expr);
  if (locMatch) return scope.locator(unquote(locMatch[1]!));

  if (candidate.raw) return scope.locator(candidate.raw);

  throw new Error(`Cannot compile locator expression: ${expr}`);
}

function unquote(s: string): string {
  return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
}

function safeJsonish(src: string): Record<string, unknown> {
  const jsonified = src
    .replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":')
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_m, inner: string) => JSON.stringify(inner));
  try {
    return filterAllowedKeys(JSON.parse(jsonified) as Record<string, unknown>);
  } catch {
    return {};
  }
}

const ALLOWED_OPTION_KEYS = new Set(['name', 'exact', 'level', 'checked', 'selected', 'pressed', 'expanded']);

function filterAllowedKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (ALLOWED_OPTION_KEYS.has(k)) out[k] = v;
  }
  return out;
}
