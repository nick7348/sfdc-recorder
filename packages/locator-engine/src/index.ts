import type { ElementSnapshot, LocatorCandidate } from './types.js';
import { detectSalesforceContext } from './salesforceContext.js';
import { getShadowPath } from './shadowDom.js';
import { buildFramePath } from './frames.js';
import { detectFieldType } from './fieldType.js';
import { detectModalContext } from './modal.js';
import { buildTestIdLocator } from './strategies/testId.js';
import { buildLabelLocator } from './strategies/label.js';
import { buildAriaRoleLocator } from './strategies/ariaRole.js';
import { buildTextLocator, buildPlaceholderLocator } from './strategies/text.js';
import { buildRelativeXPath } from './strategies/relativeXPath.js';

export type { ElementSnapshot, LocatorCandidate, LocatorKind, SalesforceContext } from './types.js';
export type { FramePathSegment } from './frames.js';
export type { SalesforceFieldType } from './fieldType.js';
export type { ModalContext } from './modal.js';
export { detectSalesforceContext } from './salesforceContext.js';
export { deepQuerySelector, deepClosest, getShadowPath } from './shadowDom.js';
export { buildFramePath } from './frames.js';
export { detectFieldType, isPopoverField } from './fieldType.js';
export { detectModalContext } from './modal.js';

/**
 * Capture all viable locator candidates for `el`, sorted by confidence DESC.
 *
 * The recorder calls this for every interaction. Storing all candidates
 * (not just the "best") is what enables Phase-2 self-healing — if the top
 * locator fails on a future run, the runner can fall back through the list.
 */
export function captureSnapshot(el: Element): ElementSnapshot {
  const builders = [
    buildTestIdLocator,
    buildLabelLocator,
    buildAriaRoleLocator,
    buildPlaceholderLocator,
    buildTextLocator,
    buildRelativeXPath,
  ];

  const candidates: LocatorCandidate[] = builders
    .map((build) => build(el))
    .filter((c): c is LocatorCandidate => c !== null)
    .sort((a, b) => b.confidence - a.confidence);

  const snap: ElementSnapshot = {
    tagName: el.tagName.toLowerCase(),
    candidates,
    shadowPath: getShadowPath(el),
    visibleText: (el.textContent ?? '').trim().slice(0, 200),
    context: detectSalesforceContext(el.ownerDocument ?? document),
    framePath: buildFramePath(el.ownerDocument?.defaultView ?? window),
    fieldType: detectFieldType(el),
    modal: detectModalContext(el),
  };
  return snap;
}

/**
 * Pick the highest-confidence locator from a snapshot.
 */
export function pickBestLocator(snapshot: ElementSnapshot): LocatorCandidate | null {
  return snapshot.candidates[0] ?? null;
}
