import { readFile, writeFile } from 'node:fs/promises';
import { chromium, expect, type BrowserContext, type Page } from '@playwright/test';
import kleur from 'kleur';
import type { Recording, RecordingStep } from '@sfdc-recorder/codegen';
import { migrateRecording } from '@sfdc-recorder/codegen';
import { resolveLocator, HealReport, applyHealing, type HealMode } from '../healing/index.js';
import {
  waitForSalesforce,
  waitForToast,
  waitForToastDismissed,
  waitForModalOpen,
  waitForModalClose,
} from '../utils/salesforceWaits.js';
import {
  selectPicklistOption,
  selectMultiPicklist,
  selectLookupRecord,
  selectComboboxOption,
  setDateValue,
  setDateTimeValue,
  setCheckboxState,
} from '../utils/sfdcFields.js';
import { withStaleRetry } from '../utils/retry.js';
import { applyFixtures, loadFixtures } from '../utils/fixtures.js';

export interface ReplayOptions {
  headed?: boolean;
  storageState?: string;
  heal?: HealMode;
  reportJson?: string;
  /** Path to a fixture JSON file used to substitute $VAR values. */
  fixtures?: string;
}

export async function replayCommand(input: string, opts: ReplayOptions): Promise<void> {
  const heal: HealMode = opts.heal ?? 'off';
  const raw = await readFile(input, 'utf8');
  const recording = migrateRecording(JSON.parse(raw));
  const fixtures = opts.fixtures ? await loadFixtures(opts.fixtures) : undefined;

  console.log(kleur.cyan('▶'), 'Replaying', kleur.bold(recording.name));
  console.log(kleur.dim(`  steps=${recording.steps.length} heal=${heal}${fixtures ? ' fixtures=on' : ''}`));

  const browser = await chromium.launch({ headless: !opts.headed, channel: 'chrome' });
  const context: BrowserContext = await browser.newContext(
    opts.storageState ? { storageState: opts.storageState } : {},
  );
  const page = await context.newPage();
  const report = new HealReport(heal);

  try {
    if (recording.startUrl) {
      await page.goto(recording.startUrl);
      await waitForSalesforce(page);
    }

    for (let i = 0; i < recording.steps.length; i++) {
      const step = recording.steps[i]!;
      await executeStep(page, step, i, report, heal, fixtures);
    }

    report.printSummary();

    if (heal === 'apply') {
      const changed = applyHealing(recording, report.healed());
      if (changed > 0) {
        await writeFile(input, JSON.stringify(recording, null, 2) + '\n', 'utf8');
        console.log(kleur.green('✓'), 'Wrote healed recording back to', kleur.cyan(input));
      }
    }

    if (opts.reportJson) {
      await writeFile(opts.reportJson, JSON.stringify(report.toJSON(), null, 2), 'utf8');
      console.log(kleur.dim(`  heal report: ${opts.reportJson}`));
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

async function executeStep(
  page: Page,
  step: RecordingStep,
  index: number,
  report: HealReport,
  heal: HealMode,
  fixtures: Record<string, string> | undefined,
): Promise<void> {
  const a = step.action;

  // Non-element actions
  if (a.type === 'navigate') {
    await page.goto(a.url);
    await waitForSalesforce(page);
    return;
  }
  if (a.type === 'waitFor') {
    await page.waitForLoadState('networkidle').catch(() => undefined);
    return;
  }
  if (a.type === 'assertUrl') {
    const expected = applyFixtures(a.expected, fixtures);
    const url = page.url();
    if (a.match === 'regex') {
      expect(new RegExp(expected).test(url)).toBeTruthy();
    } else if (a.match === 'exact') {
      expect(url).toBe(expected);
    } else {
      expect(url).toContain(expected);
    }
    return;
  }
  if (a.type === 'assertToast') {
    const text = a.text ? applyFixtures(a.text, fixtures) : undefined;
    await waitForToast(page, {
      ...(text ? { text } : {}),
      ...(a.variant ? { variant: a.variant } : {}),
    });
    return;
  }

  // Element-bound actions and assertions go through self-healing resolution.
  const candidates = heal === 'off' ? a.snapshot.candidates.slice(0, 1) : a.snapshot.candidates;

  await withStaleRetry(async () => {
    const resolved = await resolveLocator(
      page,
      { ...a.snapshot, candidates },
      { perCandidateTimeoutMs: heal === 'off' ? 10_000 : 2_500 },
    );

    report.record({
      stepId: step.id,
      stepIndex: index,
      fallbackIndex: resolved.fallbackIndex,
      attempts: resolved.attempts,
      winner: resolved.candidate,
      originalCandidates: a.snapshot.candidates,
    });

    switch (a.type) {
      case 'click':
        await resolved.locator.click();
        // If this click was supposed to open a modal, wait for it.
        if (step.comment?.toLowerCase().includes('opens modal')) {
          await waitForModalOpen(page);
        }
        break;
      case 'dblclick':
        await resolved.locator.dblclick();
        break;
      case 'input':
      case 'change':
        await resolved.locator.fill(applyFixtures(a.value, fixtures));
        break;
      case 'select':
        await resolved.locator.selectOption(applyFixtures(a.value, fixtures));
        break;
      case 'press':
        await resolved.locator.press(a.key);
        break;
      case 'picklist':
        await selectPicklistOption(resolved.locator, applyFixtures(a.optionLabel, fixtures));
        break;
      case 'multipicklist':
        await selectMultiPicklist(
          resolved.locator,
          a.optionLabels.map((l) => applyFixtures(l, fixtures)),
        );
        break;
      case 'lookup':
        await selectLookupRecord(
          resolved.locator,
          applyFixtures(a.searchText, fixtures),
          applyFixtures(a.selectedRecord, fixtures),
        );
        break;
      case 'combobox':
        await selectComboboxOption(resolved.locator, applyFixtures(a.optionLabel, fixtures));
        break;
      case 'date':
        await setDateValue(resolved.locator, applyFixtures(a.isoValue, fixtures));
        break;
      case 'datetime':
        await setDateTimeValue(resolved.locator, applyFixtures(a.isoValue, fixtures));
        break;
      case 'checkbox':
        await setCheckboxState(resolved.locator, a.checked);
        break;
      case 'fileUpload':
        await resolved.locator.setInputFiles(a.filePaths);
        break;
      case 'assertVisible':
        await expect(resolved.locator).toBeVisible();
        break;
      case 'assertHidden':
        await expect(resolved.locator).toBeHidden();
        break;
      case 'assertText': {
        const expected = applyFixtures(a.expected, fixtures);
        if (a.match === 'regex') {
          await expect(resolved.locator).toHaveText(new RegExp(expected));
        } else if (a.match === 'contains') {
          await expect(resolved.locator).toContainText(expected);
        } else {
          await expect(resolved.locator).toHaveText(expected);
        }
        break;
      }
      case 'assertValue':
        await expect(resolved.locator).toHaveValue(applyFixtures(a.expected, fixtures));
        break;
    }
  });

  // After Save-like clicks, opportunistically wait for toast then dismissal.
  if (
    a.type === 'click' &&
    /save|submit|create|delete/i.test(step.comment ?? '') &&
    !step.comment?.toLowerCase().includes('skip toast wait')
  ) {
    await waitForToast(page, { timeoutMs: 5_000 }).catch(() => undefined);
    await waitForToastDismissed(page, 8_000);
  }

  // After Save inside a modal, wait for the modal to close.
  if (a.type === 'click' && step.comment?.toLowerCase().includes('closes modal')) {
    await waitForModalClose(page).catch(() => undefined);
  }
}
