/**
 * Content script — installs DOM event listeners and forwards interactions to
 * the background service worker.
 *
 * v2 capabilities:
 *  - Salesforce field-type detection: emits `picklist`/`lookup`/`combobox`/
 *    `multipicklist`/`date`/`checkbox` steps when applicable
 *  - Assertion mode: clicks become assertVisible/assertText/assertValue steps
 *  - Frame paths captured automatically via captureSnapshot()
 *  - Runs in all_frames so iframe interactions are captured
 */

import {
  captureSnapshot,
  detectSalesforceContext,
  detectFieldType,
  isPopoverField,
  type SalesforceFieldType,
} from '@sfdc-recorder/locator-engine';
import type { Message, RecordedAction, RecorderMode, RecordingStep } from '../shared/messages.js';

let mode: RecorderMode = 'idle';

void refreshState();

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.kind === 'rec/state') void refreshState();
});

async function refreshState(): Promise<void> {
  try {
    const tabId = await getTabId();
    const reply = (await chrome.runtime.sendMessage({ kind: 'rec/state', tabId } satisfies Message)) as
      | (Message & { kind: 'rec/snapshot' })
      | undefined;
    mode = reply?.mode ?? 'idle';
  } catch {
    /* background not ready yet */
  }
}

async function getTabId(): Promise<number> {
  const probe = (await chrome.runtime.sendMessage({ kind: 'rec/state', tabId: -1 } satisfies Message)) as
    | (Message & { kind: 'rec/snapshot' })
    | undefined;
  return probe?.tabId ?? -1;
}

const handlers: Array<[keyof DocumentEventMap, EventListener, AddEventListenerOptions?]> = [
  ['click', onClick, { capture: true }],
  ['dblclick', onDblClick, { capture: true }],
  ['input', onInput, { capture: true }],
  ['change', onChange, { capture: true }],
  ['keydown', onKeyDown, { capture: true }],
];

for (const [type, fn, opts] of handlers) {
  document.addEventListener(type, fn, opts);
}

function active(): boolean {
  return mode === 'recording' || mode === 'asserting';
}

async function onClick(ev: Event): Promise<void> {
  if (!active()) return;
  const target = resolveTarget(ev);
  if (!target) return;

  if (mode === 'asserting') {
    await emit({ type: 'assertVisible', snapshot: captureSnapshot(target) });
    return;
  }

  // Salesforce-specific clicks: opening a picklist combobox shouldn't be
  // recorded as a generic click — wait for the option click and emit one
  // semantic `picklist` step. We use a small click-coalescing buffer.
  const fieldType = detectFieldType(target);
  if (isPopoverField(fieldType) && shouldDeferAsPopoverInteraction(target, fieldType)) {
    pendingPopover = {
      anchor: target,
      fieldType,
      startedAt: Date.now(),
    };
    // do not emit yet — wait for the option click
    return;
  }

  // If a popover interaction is in flight and the user clicked an option,
  // emit a single field-typed step.
  if (pendingPopover && isOptionClick(target)) {
    const optionLabel = (target.textContent ?? '').trim();
    const snapshot = captureSnapshot(pendingPopover.anchor);
    await emit(buildPopoverAction(pendingPopover.fieldType, snapshot, optionLabel));
    pendingPopover = null;
    return;
  }

  await emit({ type: 'click', snapshot: captureSnapshot(target) });
}

interface PendingPopover {
  anchor: Element;
  fieldType: SalesforceFieldType;
  startedAt: number;
}

let pendingPopover: PendingPopover | null = null;

function shouldDeferAsPopoverInteraction(target: Element, fieldType: SalesforceFieldType): boolean {
  // Only defer if the click looks like opening a combobox button/input,
  // not clicking inside an already-open list.
  if (isOptionClick(target)) return false;
  return Boolean(fieldType);
}

function isOptionClick(el: Element): boolean {
  return (
    el.getAttribute('role') === 'option' ||
    Boolean(el.closest?.('[role="option"]')) ||
    Boolean(el.closest?.('.slds-listbox__option'))
  );
}

function buildPopoverAction(
  fieldType: SalesforceFieldType,
  snapshot: ReturnType<typeof captureSnapshot>,
  optionLabel: string,
): RecordedAction {
  switch (fieldType) {
    case 'picklist':
      return { type: 'picklist', snapshot, optionLabel };
    case 'multipicklist':
      return { type: 'multipicklist', snapshot, optionLabels: [optionLabel] };
    case 'lookup':
      return { type: 'lookup', snapshot, searchText: '', selectedRecord: optionLabel };
    case 'combobox':
      return { type: 'combobox', snapshot, optionLabel };
    default:
      return { type: 'click', snapshot };
  }
}

async function onDblClick(ev: Event): Promise<void> {
  if (!active()) return;
  const target = resolveTarget(ev);
  if (!target) return;
  await emit({ type: 'dblclick', snapshot: captureSnapshot(target) });
}

async function onInput(ev: Event): Promise<void> {
  if (!active()) return;
  const target = resolveTarget(ev);
  if (!target) return;
  const fieldType = detectFieldType(target);
  const value = readValue(target);
  if (value === null) return;

  // Lookup typing: capture the search text but emit only on selection.
  if (fieldType === 'lookup' && pendingPopover) {
    pendingPopover.fieldType = 'lookup';
    pendingPopover.anchor = target;
    // remember the search text on the pending object
    (pendingPopover as PendingPopover & { searchText?: string }).searchText = value;
    return;
  }

  if (fieldType === 'date' || fieldType === 'datetime') {
    if (mode === 'asserting') {
      await emit({ type: 'assertValue', snapshot: captureSnapshot(target), expected: value });
    } else {
      await emit({ type: fieldType, snapshot: captureSnapshot(target), isoValue: value });
    }
    return;
  }

  if (mode === 'asserting') {
    await emit({ type: 'assertValue', snapshot: captureSnapshot(target), expected: value });
    return;
  }

  await emit({ type: 'input', snapshot: captureSnapshot(target), value });
}

async function onChange(ev: Event): Promise<void> {
  if (!active()) return;
  const target = resolveTarget(ev);
  if (!target) return;
  const tag = target.tagName.toLowerCase();
  const fieldType = detectFieldType(target);

  if (fieldType === 'checkbox' || fieldType === 'toggle') {
    const checked = (target as HTMLInputElement).checked;
    await emit({ type: 'checkbox', snapshot: captureSnapshot(target), checked });
    return;
  }

  if (tag === 'select') {
    const value = readValue(target) ?? '';
    if (fieldType === 'multipicklist') {
      const opts = Array.from((target as HTMLSelectElement).selectedOptions).map((o) => o.label);
      await emit({ type: 'multipicklist', snapshot: captureSnapshot(target), optionLabels: opts });
    } else {
      await emit({ type: 'picklist', snapshot: captureSnapshot(target), optionLabel: value });
    }
  }
}

async function onKeyDown(ev: Event): Promise<void> {
  if (!active()) return;
  const e = ev as KeyboardEvent;
  const RECORDABLE = new Set(['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  if (!RECORDABLE.has(e.key)) return;
  const target = resolveTarget(ev);
  if (!target) return;
  await emit({ type: 'press', snapshot: captureSnapshot(target), key: e.key });
}

function resolveTarget(ev: Event): Element | null {
  const path = ev.composedPath();
  for (const node of path) {
    if (node instanceof Element) return node;
  }
  return null;
}

function readValue(el: Element): string | null {
  if ('value' in el) {
    const v = (el as HTMLInputElement).value;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

async function emit(action: RecordedAction): Promise<void> {
  const tabId = await getTabId();
  const step: RecordingStep = { id: crypto.randomUUID(), timestamp: Date.now(), action };
  await chrome.runtime.sendMessage({ kind: 'rec/append-step', tabId, step } satisfies Message);
}

window.addEventListener('beforeunload', () => {
  void chrome.runtime.sendMessage({ kind: 'rec/state', tabId: -1 } satisfies Message);
});

document.documentElement.dataset['sfdcContext'] = detectSalesforceContext();
