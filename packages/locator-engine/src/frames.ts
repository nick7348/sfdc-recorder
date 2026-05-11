/**
 * Frame path discovery for Salesforce.
 *
 * Visualforce pages are embedded in iframes. Lightning Out and Aura embedded
 * apps also use iframes. The replay engine needs to know the chain of frame
 * URLs (or selectors) to drill into before resolving an element.
 */

export interface FramePathSegment {
  /** URL substring of the frame at this depth (best for matching). */
  urlMatch?: string;
  /** Frame element selector relative to its parent (used as a fallback). */
  selector?: string;
  /** name attribute, useful for VF iframes which often have stable names. */
  name?: string;
}

/**
 * Build a path describing how to reach the current frame from the top window.
 * Empty array means we're already in the top frame.
 *
 * Walks up `window.parent` until we hit `window.top`. For each frame, we
 * record url + name so the replay engine can match it.
 */
export function buildFramePath(win: Window = window): FramePathSegment[] {
  const segments: FramePathSegment[] = [];
  let current: Window | null = win;

  while (current && current !== current.parent) {
    const frameElement = safeGetFrameElement(current);
    const seg: FramePathSegment = {};
    try {
      const url = current.location?.href;
      if (url) seg.urlMatch = extractStablePartOfUrl(url);
    } catch {
      /* cross-origin frame — fall through to selector */
    }
    if (frameElement) {
      const name = frameElement.getAttribute('name');
      if (name) seg.name = name;
      seg.selector = describeFrameSelector(frameElement);
    }
    segments.unshift(seg);

    try {
      current = current.parent;
    } catch {
      break;
    }
  }

  return segments;
}

function safeGetFrameElement(win: Window): HTMLIFrameElement | HTMLFrameElement | null {
  try {
    const fe = win.frameElement;
    if (fe instanceof HTMLIFrameElement || fe instanceof HTMLFrameElement) return fe;
  } catch {
    /* cross-origin */
  }
  return null;
}

function describeFrameSelector(el: HTMLIFrameElement | HTMLFrameElement): string {
  const name = el.getAttribute('name');
  if (name) return `iframe[name="${cssEscape(name)}"]`;
  const id = el.id;
  if (id) return `iframe#${cssEscape(id)}`;
  const title = el.getAttribute('title');
  if (title) return `iframe[title="${cssEscape(title)}"]`;
  const src = el.getAttribute('src');
  if (src) return `iframe[src*="${cssEscape(extractStablePartOfUrl(src))}"]`;
  return 'iframe';
}

/**
 * Extract a stable portion of a URL — drop query params and session-scoped
 * tokens which change every run. Keep the path so we can re-match.
 */
function extractStablePartOfUrl(url: string): string {
  try {
    const u = new URL(url, 'https://salesforce.com');
    return u.pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}
