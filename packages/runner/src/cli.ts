#!/usr/bin/env node
import { Command } from 'commander';
import kleur from 'kleur';
import { genCommand } from './commands/gen.js';
import { runCommand } from './commands/run.js';
import { authCommand } from './commands/auth.js';
import { replayCommand } from './commands/replay.js';
import type { HealMode } from './healing/index.js';

const program = new Command();

program
  .name('sfdc-rec')
  .description('Record Salesforce flows in Chrome and replay them with Playwright.')
  .version('0.1.0');

program
  .command('gen')
  .description('Generate a Playwright .spec.ts from a .recording.json')
  .argument('<input>', 'Path to .recording.json')
  .option('-o, --output <path>', 'Output spec file (defaults to tests/<name>.spec.ts)')
  .option('--no-fallback-hints', 'Omit fallback locator comments')
  .option('--no-insert-waits', 'Skip auto-injecting waitForSalesforce calls')
  .option('--no-groups-as-functions', 'Inline group steps instead of emitting helper functions')
  .option('--parameterize', 'Emit a typed Fixture parameter and substitute $VAR via fixture.VAR')
  .action(async (input: string, opts) => {
    try {
      await genCommand(input, opts);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('run')
  .description('Run a Playwright spec with Salesforce-tuned defaults')
  .argument('<target>', 'Path to spec file or directory')
  .option('--headed', 'Run with a visible browser')
  .option('--storage-state <path>', 'Reuse a logged-in session (see `sfdc-rec auth`)')
  .option('--retries <n>', 'Number of retries on failure', (v) => parseInt(v, 10))
  .action(async (target: string, opts) => {
    try {
      await runCommand(target, opts);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('replay')
  .description(
    'Replay a .recording.json directly (no codegen step). Supports self-healing locators.',
  )
  .argument('<input>', 'Path to .recording.json')
  .option('--headed', 'Run with a visible browser')
  .option('--storage-state <path>', 'Reuse a logged-in session (see `sfdc-rec auth`)')
  .option(
    '--heal <mode>',
    'Locator self-healing mode: off | report | apply (default: off)',
    (value) => parseHealMode(value),
    'off' as HealMode,
  )
  .option('--report-json <path>', 'Write a JSON heal report to this path (for CI)')
  .option('--fixtures <path>', 'JSON fixture file with values for $VAR placeholders')
  .action(async (input: string, opts) => {
    try {
      await replayCommand(input, opts);
    } catch (err) {
      fail(err);
    }
  });

program
  .command('auth')
  .description('Log into Salesforce once and save the session for reuse')
  .requiredOption('--url <url>', 'Salesforce login URL (e.g. https://my.lightning.force.com)')
  .requiredOption('-o, --output <path>', 'Where to save the storageState JSON')
  .action(async (opts) => {
    try {
      await authCommand(opts);
    } catch (err) {
      fail(err);
    }
  });

program.parseAsync(process.argv).catch(fail);

function fail(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(kleur.red('✗'), msg);
  process.exit(1);
}

function parseHealMode(value: string): HealMode {
  if (value === 'off' || value === 'report' || value === 'apply') return value;
  throw new Error(`Invalid --heal value '${value}'. Expected: off | report | apply`);
}
