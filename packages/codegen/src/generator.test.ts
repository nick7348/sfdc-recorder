import { describe, it, expect } from 'vitest';
import { generateSpec } from './generator.js';
import type { Recording } from './types.js';

function makeRecording(overrides: Partial<Recording> = {}): Recording {
  return {
    version: 1,
    name: 'sample-flow',
    createdAt: '2026-05-07T12:00:00.000Z',
    startUrl: 'https://x.lightning.force.com/lightning/o/Account/list',
    context: 'lightning',
    steps: [],
    ...overrides,
  };
}

describe('generateSpec', () => {
  it('emits a Playwright test wrapper with the recording name', () => {
    const code = generateSpec(makeRecording());
    expect(code).toMatch(/import \{ test, expect \} from '@playwright\/test';/);
    expect(code).toMatch(/test\("sample-flow", async \(\{ page \}\) => \{/);
  });

  it('inserts page.goto for the startUrl', () => {
    const code = generateSpec(makeRecording());
    expect(code).toContain(
      `await page.goto("https://x.lightning.force.com/lightning/o/Account/list");`,
    );
  });

  it('emits one numbered comment block per step', () => {
    const rec = makeRecording({
      steps: [
        {
          id: '1',
          timestamp: 0,
          action: {
            type: 'click',
            snapshot: {
              tagName: 'button',
              visibleText: 'Save',
              shadowPath: [],
              context: 'lightning',
              candidates: [
                {
                  kind: 'ariaRole',
                  playwright: 'getByRole("button", { name: "Save" })',
                  confidence: 0.85,
                  description: 'role=button name="Save"',
                },
              ],
            },
          },
        },
      ],
    });
    const code = generateSpec(rec);
    expect(code).toContain('// Step 1:');
    expect(code).toContain('await page.getByRole("button", { name: "Save" }).click();');
  });

  it('inlines the top candidate and lists fallbacks as comments', () => {
    const rec = makeRecording({
      steps: [
        {
          id: 'a',
          timestamp: 0,
          action: {
            type: 'click',
            snapshot: {
              tagName: 'button',
              visibleText: 'New',
              shadowPath: [],
              context: 'lightning',
              candidates: [
                {
                  kind: 'ariaRole',
                  playwright: 'getByRole("button", { name: "New" })',
                  confidence: 0.85,
                  description: 'role=button',
                },
                {
                  kind: 'text',
                  playwright: 'getByText("New", { exact: true })',
                  confidence: 0.6,
                  description: 'visible text "New"',
                },
              ],
            },
          },
        },
      ],
    });
    const code = generateSpec(rec, { includeFallbackHints: true });
    expect(code).toContain('await page.getByRole("button", { name: "New" }).click();');
    expect(code).toContain('// fallbacks (decreasing confidence):');
    expect(code).toContain('//   - page.getByText("New", { exact: true })');
  });

  it('omits fallback comments when includeFallbackHints=false', () => {
    const rec = makeRecording({
      steps: [
        {
          id: 'a',
          timestamp: 0,
          action: {
            type: 'click',
            snapshot: {
              tagName: 'button',
              visibleText: '',
              shadowPath: [],
              context: 'lightning',
              candidates: [
                {
                  kind: 'ariaRole',
                  playwright: 'getByRole("button")',
                  confidence: 0.5,
                  description: '',
                },
                {
                  kind: 'text',
                  playwright: 'getByText("X")',
                  confidence: 0.6,
                  description: '',
                },
              ],
            },
          },
        },
      ],
    });
    const code = generateSpec(rec, { includeFallbackHints: false });
    expect(code).not.toContain('fallbacks');
  });

  it('emits .fill for input actions', () => {
    const rec = makeRecording({
      steps: [
        {
          id: 'a',
          timestamp: 0,
          action: {
            type: 'input',
            value: 'Acme Corp',
            snapshot: {
              tagName: 'input',
              visibleText: '',
              shadowPath: [],
              context: 'lightning',
              candidates: [
                {
                  kind: 'label',
                  playwright: 'getByLabel("Account Name", { exact: true })',
                  confidence: 0.9,
                  description: 'labelled "Account Name"',
                },
              ],
            },
          },
        },
      ],
    });
    const code = generateSpec(rec);
    expect(code).toContain(
      `await page.getByLabel("Account Name", { exact: true }).fill("Acme Corp");`,
    );
  });

  it('imports waitForSalesforce and inserts it after navigations', () => {
    const code = generateSpec(makeRecording(), { insertSalesforceWaits: true });
    expect(code).toContain(
      `import { waitForSalesforce } from '@sfdc-recorder/runner/waits';`,
    );
    expect(code).toContain('await waitForSalesforce(page);');
  });

  it('skips waitForSalesforce when insertSalesforceWaits=false', () => {
    const code = generateSpec(makeRecording(), { insertSalesforceWaits: false });
    expect(code).not.toContain('waitForSalesforce');
  });
});
