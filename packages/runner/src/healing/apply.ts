import type { Recording, RecordingStep } from '@sfdc-recorder/codegen';
import type { StepHealRecord } from './report.js';

/**
 * Mutate `recording` in place so each healed step's candidate list is reordered:
 * the candidate that actually worked is promoted to position 0.
 *
 * We DO NOT delete the previous top candidate — only re-rank. Two reasons:
 *   1. The previous top might come back to life after a Salesforce hot-fix.
 *   2. Keeping the full list intact preserves the audit trail (you can see
 *      what changed by diffing the JSON).
 */
export function applyHealing(recording: Recording, healed: StepHealRecord[]): number {
  const byId = new Map(recording.steps.map((s) => [s.id, s]));
  let changed = 0;

  for (const h of healed) {
    const step = byId.get(h.stepId);
    if (!step) continue;
    if (!('snapshot' in step.action)) continue;

    const candidates = step.action.snapshot.candidates;
    const idx = h.fallbackIndex;
    if (idx <= 0 || idx >= candidates.length) continue;

    const winner = candidates[idx]!;
    candidates.splice(idx, 1);
    candidates.unshift(winner);

    step.comment = composeHealComment(step, h);
    changed++;
  }

  return changed;
}

function composeHealComment(step: RecordingStep, h: StepHealRecord): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const previous = step.comment ? `${step.comment} ` : '';
  return `${previous}[auto-healed ${stamp}: promoted ${h.winner.kind} (${h.winner.description})]`;
}
