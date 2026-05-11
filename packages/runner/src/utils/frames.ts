import type { FrameLocator, Page } from '@playwright/test';
import type { FramePathSegment } from '@sfdc-recorder/locator-engine';

/**
 * Walk into the frame chain captured by the recorder. Returns a FrameLocator
 * (or the page itself if the path is empty / top frame).
 *
 * Strategy per segment:
 *  1. If `name` is present, prefer `iframe[name="..."]` (most stable for VF).
 *  2. Else if `selector` is present, use it.
 *  3. Else fall back to URL substring match.
 */
export function resolveFrame(page: Page, framePath?: FramePathSegment[]): Page | FrameLocator {
  if (!framePath || framePath.length === 0) return page;

  let scope: Page | FrameLocator = page;
  for (const seg of framePath) {
    const sel = pickFrameSelector(seg);
    scope = (scope as Page).frameLocator(sel);
  }
  return scope;
}

function pickFrameSelector(seg: FramePathSegment): string {
  if (seg.name) return `iframe[name="${escape(seg.name)}"]`;
  if (seg.selector) return seg.selector;
  if (seg.urlMatch) return `iframe[src*="${escape(seg.urlMatch)}"]`;
  return 'iframe';
}

function escape(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Render a Playwright source-code expression for a frame path.
 * Used by codegen to emit:
 *   page.frameLocator('iframe[name="vf"]').frameLocator('iframe[src*="/foo"]')
 */
export function renderFrameExpression(framePath?: FramePathSegment[]): string {
  if (!framePath || framePath.length === 0) return 'page';
  let expr = 'page';
  for (const seg of framePath) {
    expr += `.frameLocator(${JSON.stringify(pickFrameSelector(seg))})`;
  }
  return expr;
}
