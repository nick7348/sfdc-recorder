import { describe, it, expect } from 'vitest';
import { isStaleError, withStaleRetry } from './retry.js';

describe('isStaleError', () => {
  it('matches Playwright "element is not attached"', () => {
    expect(isStaleError(new Error('Error: element is not attached to the DOM'))).toBe(true);
  });
  it('matches "stale element"', () => {
    expect(isStaleError(new Error('stale element reference'))).toBe(true);
  });
  it('matches "intercepts pointer events"', () => {
    expect(isStaleError(new Error('element intercepts pointer events'))).toBe(true);
  });
  it('does not match unrelated errors', () => {
    expect(isStaleError(new Error('Network timeout'))).toBe(false);
    expect(isStaleError('not even an error')).toBe(false);
  });
});

describe('withStaleRetry', () => {
  it('returns the result on first try when no error', async () => {
    const result = await withStaleRetry(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('retries on stale error and succeeds', async () => {
    let attempts = 0;
    const result = await withStaleRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw new Error('element is not attached to the DOM');
        return 'ok';
      },
      { baseDelayMs: 1 },
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('rethrows non-stale errors immediately', async () => {
    let attempts = 0;
    await expect(
      withStaleRetry(async () => {
        attempts++;
        throw new Error('Network down');
      }),
    ).rejects.toThrow('Network down');
    expect(attempts).toBe(1);
  });

  it('gives up after max attempts on persistent stale errors', async () => {
    let attempts = 0;
    await expect(
      withStaleRetry(
        async () => {
          attempts++;
          throw new Error('stale element');
        },
        { attempts: 3, baseDelayMs: 1 },
      ),
    ).rejects.toThrow('stale element');
    expect(attempts).toBe(3);
  });
});
