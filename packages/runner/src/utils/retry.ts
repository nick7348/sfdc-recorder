/**
 * Retry an async action that may transiently fail because the target element
 * was re-rendered (Lightning's LWC re-rendering during state updates).
 *
 * Detects "stale" errors (Playwright reports them as "element is not attached"
 * or "element is not visible") and re-runs the supplied resolver to get a
 * fresh handle, then retries the action.
 */
export interface RetryOptions {
  /** Total max attempts (1 = no retry). */
  attempts?: number;
  /** Base backoff ms, multiplied by attempt number. */
  baseDelayMs?: number;
}

const STALE_PATTERNS: RegExp[] = [
  /element\s+is\s+not\s+(attached|visible)/i,
  /detached\s+from\s+the\s+DOM/i,
  /stale\s+element/i,
  /no\s+node\s+found/i,
  /element\s+intercepts\s+pointer\s+events/i,
];

export function isStaleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return STALE_PATTERNS.some((re) => re.test(msg));
}

/**
 * Run `op`, retrying on stale-element errors. Each retry runs `op` again
 * (so the caller is responsible for re-resolving the locator inside).
 */
export async function withStaleRetry<T>(
  op: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 250;

  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isStaleError(err) || i === attempts) throw err;
      await new Promise<void>((res) => setTimeout(res, base * i));
    }
  }
  throw lastErr;
}
