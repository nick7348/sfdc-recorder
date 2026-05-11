import type { Locator, Page } from '@playwright/test';

/**
 * Salesforce-aware wait. Use this after navigations and major state changes.
 *
 * Layered:
 *   1. waitForLoadState('domcontentloaded')
 *   2. wait for Lightning aura init OR Classic body marker (best-effort)
 *   3. wait for global SLDS spinner to disappear
 *   4. short settling delay for async LWC re-renders
 */
export async function waitForSalesforce(page: Page, opts: { timeoutMs?: number } = {}): Promise<void> {
  const timeout = opts.timeoutMs ?? 30_000;
  await page.waitForLoadState('domcontentloaded', { timeout });

  await page
    .waitForFunction(
      () => {
        if (document.querySelector('[data-aura-rendered-by]')) return true;
        if (document.querySelector('body#bodyTag')) return true;
        return false;
      },
      undefined,
      { timeout },
    )
    .catch(() => undefined);

  await waitForSpinnersGone(page, Math.min(timeout, 15_000));
  await page.waitForTimeout(250);
}

/**
 * Wait until all Salesforce spinners disappear. Includes both global and
 * inline (per-component) spinners.
 */
export async function waitForSpinnersGone(page: Page, timeoutMs = 15_000): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const spinners = document.querySelectorAll('.slds-spinner_container, .slds-spinner');
        return spinners.length === 0;
      },
      undefined,
      { timeout: timeoutMs },
    )
    .catch(() => undefined);
}

/**
 * Wait for a Salesforce toast to appear, optionally matching text/variant.
 *
 * Toasts are how Lightning surfaces "Account saved" / "Error: required field"
 * messages. Asserting on them is the cleanest way to verify a Save succeeded.
 *
 * Returns the toast locator so the caller can read its text/icon if needed.
 */
export async function waitForToast(
  page: Page,
  options: { text?: string; variant?: 'success' | 'error' | 'warning' | 'info'; timeoutMs?: number } = {},
): Promise<Locator> {
  const timeout = options.timeoutMs ?? 15_000;
  let locator: Locator = page.locator('.slds-notify_toast, [role="status"].slds-notify');
  if (options.variant) {
    locator = locator.filter({ has: page.locator(`.slds-icon-utility-${variantToIcon(options.variant)}`) });
  }
  if (options.text) {
    locator = locator.filter({ hasText: options.text });
  }
  await locator.first().waitFor({ state: 'visible', timeout });
  return locator.first();
}

function variantToIcon(v: 'success' | 'error' | 'warning' | 'info'): string {
  switch (v) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
  }
}

/**
 * Wait for a Salesforce toast to dismiss. Useful between steps so the toast
 * doesn't cover a button you're about to click.
 */
export async function waitForToastDismissed(page: Page, timeoutMs = 10_000): Promise<void> {
  await page
    .waitForFunction(
      () => !document.querySelector('.slds-notify_toast, [role="status"].slds-notify'),
      undefined,
      { timeout: timeoutMs },
    )
    .catch(() => undefined);
}

/**
 * Wait for a Lightning modal/dialog to OPEN. Use after a button click that
 * is supposed to open a modal (New, Edit, etc.).
 */
export async function waitForModalOpen(
  page: Page,
  options: { heading?: string; timeoutMs?: number } = {},
): Promise<Locator> {
  const timeout = options.timeoutMs ?? 15_000;
  let locator: Locator = page.locator('section[role="dialog"], .slds-modal');
  if (options.heading) {
    locator = locator.filter({ hasText: options.heading });
  }
  await locator.first().waitFor({ state: 'visible', timeout });
  // give the modal a beat to finish its open animation + focus its first input
  await page.waitForTimeout(200);
  return locator.first();
}

/**
 * Wait for a Lightning modal to CLOSE. Use after Save/Cancel.
 */
export async function waitForModalClose(page: Page, timeoutMs = 15_000): Promise<void> {
  await page
    .waitForFunction(
      () => !document.querySelector('section[role="dialog"]:not([hidden]), .slds-modal:not([hidden])'),
      undefined,
      { timeout: timeoutMs },
    )
    .catch(() => undefined);
}
