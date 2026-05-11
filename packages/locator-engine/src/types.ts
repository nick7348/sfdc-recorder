/**
 * Locator strategy kinds, ordered by preference (most stable first).
 */
export type LocatorKind =
  | 'testId'
  | 'label'
  | 'ariaRole'
  | 'placeholder'
  | 'text'
  | 'css'
  | 'relativeXPath';

/**
 * A single locator candidate produced by one strategy.
 * The recording stores ALL viable candidates so the runner (and a future
 * self-healing layer) can fall back when one breaks.
 */
export interface LocatorCandidate {
  kind: LocatorKind;
  /** A Playwright-compatible selector string (e.g. `getByRole('button', { name: 'Save' })`). */
  playwright: string;
  /** A raw CSS or XPath fallback, useful for non-Playwright runners. */
  raw?: string;
  /**
   * Confidence 0..1. Higher = more stable across renders.
   * testId=1.0, label=0.9, role=0.85, text=0.6, css=0.4, xpath=0.2
   */
  confidence: number;
  /** Human-readable description used in generated test comments. */
  description: string;
}

/**
 * The page context tells the runner which Salesforce surface we're on,
 * which affects waits, frame selection, and locator preferences.
 */
export type SalesforceContext = 'lightning' | 'classic' | 'unknown';

/**
 * A snapshot of an element + the surrounding signals needed to relocate it
 * on subsequent runs.
 */
export interface ElementSnapshot {
  /** Tag name lowercased: 'button', 'lightning-input', etc. */
  tagName: string;
  /** All locator candidates, sorted by confidence DESC. */
  candidates: LocatorCandidate[];
  /** Trail of shadow root host tags from document down to the element. */
  shadowPath: string[];
  /** Visible text at capture time (used by self-healing as a tiebreaker). */
  visibleText: string;
  /** Surrounding Salesforce context for this snapshot. */
  context: SalesforceContext;
  /** Frame chain (top-down) leading to this element. Empty = top frame. */
  framePath?: import('./frames.js').FramePathSegment[];
  /** Salesforce field type if this element is a form control. */
  fieldType?: import('./fieldType.js').SalesforceFieldType;
  /** Modal context (whether this element is inside a dialog). */
  modal?: import('./modal.js').ModalContext;
}
