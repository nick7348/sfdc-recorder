import type { FrameLocator, Locator, Page } from '@playwright/test';
import { waitForSpinnersGone } from './salesforceWaits.js';

/**
 * Salesforce field interaction helpers.
 *
 * Generated tests call these instead of plain `.fill()` / `.click()` so the
 * code stays readable and the trickier popover/multi-select logic lives in
 * one place (this file) rather than scattered across recordings.
 */

export type Scope = Page | FrameLocator;

/**
 * Single-select picklist (lightning-combobox or native <select>).
 * Opens the combobox if needed, then clicks the option by label.
 */
export async function selectPicklistOption(
  field: Locator,
  optionLabel: string,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 10_000;
  // Native <select> short-circuit
  const tag = await field.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
  if (tag === 'select') {
    await field.selectOption({ label: optionLabel });
    return;
  }
  // Lightning-combobox: click to open, click option by visible text.
  await field.click({ timeout });
  const listbox = field.page().locator('[role="listbox"]:visible, .slds-listbox:visible');
  await listbox
    .first()
    .getByRole('option', { name: optionLabel, exact: true })
    .click({ timeout });
  await waitForSpinnersGone(field.page(), 5_000);
}

/**
 * Lightning combobox alias (we keep it separate from picklist to allow
 * future divergence in handling).
 */
export const selectComboboxOption = selectPicklistOption;

/**
 * Multi-select picklist. Click each option in turn — Lightning toggles
 * selection on click, so we click each label once.
 *
 * For lightning-dual-listbox (the left-right shuffler), this finds the
 * "Available" listbox, selects each item, and clicks the right-arrow to
 * move them across.
 */
export async function selectMultiPicklist(
  field: Locator,
  optionLabels: string[],
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 15_000;
  // Detect dual-listbox vs combobox-multi.
  const isDualListbox = await field
    .evaluate((el) => Boolean(el.closest?.('lightning-dual-listbox')))
    .catch(() => false);

  if (isDualListbox) {
    const dual = field.locator('xpath=ancestor::lightning-dual-listbox').first();
    const available = dual.locator('[data-source-list]').first();
    const moveRight = dual.getByRole('button', { name: /move selection to/i }).first();
    for (const label of optionLabels) {
      await available.getByRole('option', { name: label, exact: true }).click({ timeout });
      await moveRight.click({ timeout });
    }
    return;
  }

  // Combobox-style multi-select: open + click each.
  await field.click({ timeout });
  const listbox = field.page().locator('[role="listbox"]:visible, .slds-listbox:visible').first();
  for (const label of optionLabels) {
    await listbox.getByRole('option', { name: label, exact: true }).click({ timeout });
  }
  // Close the popover by pressing Escape so it doesn't intercept the next action.
  await field.page().keyboard.press('Escape');
}

/**
 * Lookup field. Type the search text, wait for matching results, click the
 * record. Lookups in Lightning are autocomplete combos.
 */
export async function selectLookupRecord(
  field: Locator,
  searchText: string,
  recordLabel: string,
  opts: { timeoutMs?: number } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 15_000;
  await field.click({ timeout });
  await field.fill(searchText, { timeout });
  // Salesforce debounces; wait briefly for the dropdown.
  await field.page().waitForTimeout(400);
  await waitForSpinnersGone(field.page(), 5_000);

  const listbox = field.page().locator('[role="listbox"]:visible').first();
  await listbox
    .getByRole('option', { name: new RegExp(escapeRegExp(recordLabel), 'i') })
    .first()
    .click({ timeout });
}

/**
 * Date picker. Salesforce's lightning-input[type="date"] accepts ISO format
 * via .fill() reliably; we wrap it for symmetry with other field helpers.
 */
export async function setDateValue(field: Locator, isoValue: string): Promise<void> {
  await field.click();
  await field.fill(isoValue);
  await field.press('Tab');
}

/**
 * Datetime picker. Lightning splits this into separate date + time inputs.
 * If the field is already datetime-local we use that; otherwise we look for
 * sibling time input.
 */
export async function setDateTimeValue(field: Locator, isoValue: string): Promise<void> {
  const inputType = await field.evaluate((el) => (el as HTMLInputElement).type).catch(() => '');
  if (inputType === 'datetime-local') {
    await field.fill(isoValue);
    return;
  }
  const [datePart, timePart] = isoValue.split('T');
  if (datePart) await field.fill(datePart);
  if (timePart) {
    const time = field.locator('xpath=ancestor::*[contains(local-name(),"datetimepicker")]//input[@type="time"]').first();
    await time.fill(timePart.replace(/:\d{2}\.\d+Z?$/, ''));
  }
  await field.press('Tab');
}

/** Set a checkbox/toggle to the desired state (idempotent). */
export async function setCheckboxState(field: Locator, checked: boolean): Promise<void> {
  const current = await field.isChecked().catch(() => false);
  if (current !== checked) {
    await field.click();
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
