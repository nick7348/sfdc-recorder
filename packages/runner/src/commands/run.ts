import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import kleur from 'kleur';

export interface RunOptions {
  headed?: boolean;
  storageState?: string;
  retries?: number;
}

/**
 * Thin wrapper around `playwright test` that:
 *   - injects our Salesforce-tuned config
 *   - sets `SFDC_STORAGE_STATE` so the user can reuse a logged-in session
 */
export async function runCommand(target: string, opts: RunOptions): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const config = resolve(here, '..', '..', 'playwright.config.ts');

  const args = ['playwright', 'test', target, '--config', config];
  if (opts.headed) args.push('--headed');
  if (opts.retries !== undefined) args.push('--retries', String(opts.retries));

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (opts.storageState) env['SFDC_STORAGE_STATE'] = opts.storageState;

  console.log(kleur.dim(`$ npx ${args.join(' ')}`));
  const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32', env });

  await new Promise<void>((resolveProm, reject) => {
    child.on('exit', (code) => {
      if (code === 0) resolveProm();
      else reject(new Error(`playwright exited with code ${code}`));
    });
  });
}
