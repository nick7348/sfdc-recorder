import type { LocatorCandidate } from '@sfdc-recorder/locator-engine';
import kleur from 'kleur';

export type HealMode = 'off' | 'report' | 'apply';

export interface StepHealRecord {
  stepId: string;
  stepIndex: number;
  /** 0 = top candidate matched (no healing), 1+ = healed via fallback. */
  fallbackIndex: number;
  attempts: number;
  /** The candidate that ultimately won. */
  winner: LocatorCandidate;
  /** Snapshot of the candidate ordering at the time of the run. */
  originalCandidates: LocatorCandidate[];
}

/**
 * Aggregates healing decisions across a replay so we can:
 *   - print a human summary at the end
 *   - feed `apply.ts` for `--heal apply`
 *   - emit machine-readable JSON for CI consumption
 */
export class HealReport {
  private readonly records: StepHealRecord[] = [];
  constructor(public readonly mode: HealMode) {}

  record(rec: StepHealRecord): void {
    this.records.push(rec);
    if (this.mode === 'off') return;
    if (rec.fallbackIndex === 0) return;

    const top = rec.originalCandidates[0];
    console.log(
      kleur.yellow('⚠ heal'),
      kleur.dim(`step ${rec.stepIndex + 1}`),
      kleur.dim('— top candidate failed:'),
      kleur.dim(top?.description ?? '?'),
    );
    console.log(
      kleur.green('  ↳ used fallback'),
      kleur.cyan(`#${rec.fallbackIndex}`),
      kleur.dim(`(${rec.winner.kind})`),
      kleur.dim(rec.winner.description),
    );
  }

  /** Steps where healing actually happened (fallbackIndex > 0). */
  healed(): StepHealRecord[] {
    return this.records.filter((r) => r.fallbackIndex > 0);
  }

  printSummary(): void {
    if (this.mode === 'off') return;
    const healedCount = this.healed().length;
    const total = this.records.length;
    if (healedCount === 0) {
      console.log(kleur.green(`✓ All ${total} step(s) used the top locator. No healing needed.`));
      return;
    }
    console.log('');
    console.log(
      kleur.yellow(`⚠ ${healedCount}/${total} step(s) needed locator healing.`),
      this.mode === 'apply'
        ? kleur.green('Recording was updated.')
        : kleur.dim('Re-run with --heal apply to persist the new locators.'),
    );
  }

  toJSON(): { mode: HealMode; total: number; healed: StepHealRecord[] } {
    return { mode: this.mode, total: this.records.length, healed: this.healed() };
  }
}
