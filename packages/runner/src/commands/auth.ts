import { chromium } from '@playwright/test';
import kleur from 'kleur';

export interface AuthOptions {
  url: string;
  output: string;
}

/**
 * Open a real Chromium window pointed at the Salesforce login URL, let the
 * user log in (incl. MFA), then save the storage state to a JSON file.
 *
 * Usage:
 *   sfdc-rec auth --url https://my.lightning.force.com --output ./session.json
 *
 * Then:
 *   sfdc-rec run tests/foo.spec.ts --storage-state ./session.json
 */
export async function authCommand(opts: AuthOptions): Promise<void> {
  console.log(kleur.cyan('Launching browser. Log in normally — including any MFA.'));
  console.log(kleur.dim(`  URL: ${opts.url}`));
  console.log(kleur.dim(`  Session will be saved to: ${opts.output}`));
  console.log('');
  console.log(kleur.yellow('When you see your Salesforce home page, press ENTER here to save.'));

  const browser = await chromium.launch({ headless: false, channel: 'chrome' });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(opts.url);

  await waitForEnter();

  await context.storageState({ path: opts.output });
  await browser.close();
  console.log(kleur.green('✓'), 'Saved session to', kleur.cyan(opts.output));
  // stdin can keep Node alive on Windows even after we pause it; ensure exit.
  process.exit(0);
}

/**
 * Wait for the user to press Enter, then immediately release stdin so Node
 * can exit cleanly. Without `pause()` the process hangs on Windows.
 */
function waitForEnter(): Promise<void> {
  return new Promise<void>((resolveProm) => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolveProm();
    });
  });
}
