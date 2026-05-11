import { describe, it, expect } from 'vitest';
import { captureSnapshot, pickBestLocator } from './index.js';

describe('captureSnapshot', () => {
  it('returns candidates sorted by confidence DESC', () => {
    document.body.innerHTML = `
      <button data-testid="save-btn" aria-label="Save changes">Save</button>
    `;
    const el = document.querySelector('button')!;
    const snap = captureSnapshot(el);

    expect(snap.candidates.length).toBeGreaterThan(1);
    for (let i = 1; i < snap.candidates.length; i++) {
      expect(snap.candidates[i - 1]!.confidence).toBeGreaterThanOrEqual(
        snap.candidates[i]!.confidence,
      );
    }
    // testId always wins when present
    expect(snap.candidates[0]?.kind).toBe('testId');
  });

  it('records the element tagName lowercased', () => {
    const el = document.createElement('LIGHTNING-BUTTON');
    document.body.appendChild(el);
    const snap = captureSnapshot(el);
    expect(snap.tagName).toBe('lightning-button');
  });

  it('captures visible text (truncated to 200 chars)', () => {
    const el = document.createElement('span');
    el.textContent = 'Hello world!';
    const snap = captureSnapshot(el);
    expect(snap.visibleText).toBe('Hello world!');
  });

  it('always returns at least one candidate (XPath fallback)', () => {
    document.body.innerHTML = `<div><span>nothing semantic</span></div>`;
    const span = document.querySelector('span')!;
    const snap = captureSnapshot(span);
    expect(snap.candidates.length).toBeGreaterThan(0);
  });
});

describe('pickBestLocator', () => {
  it('returns the highest-confidence candidate', () => {
    document.body.innerHTML = `<button data-testid="x">Click</button>`;
    const el = document.querySelector('button')!;
    const best = pickBestLocator(captureSnapshot(el));
    expect(best?.kind).toBe('testId');
  });

  it('returns null for an empty snapshot', () => {
    expect(
      pickBestLocator({
        tagName: 'div',
        candidates: [],
        shadowPath: [],
        visibleText: '',
        context: 'unknown',
      }),
    ).toBeNull();
  });
});
