/**
 * Detect whether an element is inside a Lightning modal/dialog.
 *
 * Salesforce modals use `<section role="dialog">` with class `slds-modal`.
 * Replays need to wait for these to OPEN before clicking buttons inside
 * them, and to CLOSE before the next action.
 */
import { deepClosest } from './shadowDom.js';

export interface ModalContext {
  inModal: boolean;
  /** Heading text — useful as a stable identifier. */
  heading?: string;
  /** Best-effort selector that uniquely identifies this modal. */
  selector?: string;
}

const MODAL_SELECTORS = [
  'section[role="dialog"]',
  '.slds-modal',
  '.modal-container',
  'lightning-dialog',
] as const;

export function detectModalContext(el: Element): ModalContext {
  const modal = deepClosest(el, MODAL_SELECTORS.join(', '));
  if (!modal) return { inModal: false };

  const heading = modal.querySelector('h1, h2, .slds-modal__title, [slot="title"]')?.textContent?.trim();
  const ctx: ModalContext = {
    inModal: true,
    selector: 'section[role="dialog"]:visible',
  };
  if (heading) ctx.heading = heading;
  return ctx;
}
