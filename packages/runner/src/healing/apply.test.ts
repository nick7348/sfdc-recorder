import { describe, it, expect } from 'vitest';
import { applyHealing } from './apply.js';
import type { StepHealRecord } from './report.js';
import type { Recording } from '@sfdc-recorder/codegen';
import type { LocatorCandidate } from '@sfdc-recorder/locator-engine';

const cTop: LocatorCandidate = {
  kind: 'ariaRole',
  playwright: 'getByRole("button", { name: "Save" })',
  confidence: 0.85,
  description: 'role=button name="Save"',
};
const cFallback: LocatorCandidate = {
  kind: 'text',
  playwright: 'getByText("Save", { exact: true })',
  confidence: 0.6,
  description: 'text "Save"',
};

function makeRecording(): Recording {
  return {
    version: 1,
    name: 'test',
    createdAt: '2026-05-07T00:00:00.000Z',
    startUrl: '',
    context: 'lightning',
    steps: [
      {
        id: 's1',
        timestamp: 0,
        action: {
          type: 'click',
          snapshot: {
            tagName: 'button',
            visibleText: 'Save',
            shadowPath: [],
            context: 'lightning',
            candidates: [cTop, cFallback],
          },
        },
      },
    ],
  };
}

describe('applyHealing', () => {
  it('promotes the winning fallback to position 0', () => {
    const rec = makeRecording();
    const healed: StepHealRecord[] = [
      {
        stepId: 's1',
        stepIndex: 0,
        fallbackIndex: 1,
        attempts: 2,
        winner: cFallback,
        originalCandidates: [cTop, cFallback],
      },
    ];
    const changed = applyHealing(rec, healed);
    expect(changed).toBe(1);
    const cands = (rec.steps[0]!.action as { snapshot: { candidates: LocatorCandidate[] } })
      .snapshot.candidates;
    expect(cands[0]).toBe(cFallback);
    expect(cands[1]).toBe(cTop);
  });

  it('preserves the previous top candidate (audit trail)', () => {
    const rec = makeRecording();
    const healed: StepHealRecord[] = [
      {
        stepId: 's1',
        stepIndex: 0,
        fallbackIndex: 1,
        attempts: 2,
        winner: cFallback,
        originalCandidates: [cTop, cFallback],
      },
    ];
    applyHealing(rec, healed);
    const cands = (rec.steps[0]!.action as { snapshot: { candidates: LocatorCandidate[] } })
      .snapshot.candidates;
    expect(cands).toContain(cTop);
    expect(cands.length).toBe(2);
  });

  it('annotates the healed step with a timestamped comment', () => {
    const rec = makeRecording();
    const healed: StepHealRecord[] = [
      {
        stepId: 's1',
        stepIndex: 0,
        fallbackIndex: 1,
        attempts: 2,
        winner: cFallback,
        originalCandidates: [cTop, cFallback],
      },
    ];
    applyHealing(rec, healed);
    expect(rec.steps[0]!.comment).toMatch(/\[auto-healed \d{4}-\d{2}-\d{2}:/);
  });

  it('skips records where fallbackIndex=0 (no actual healing)', () => {
    const rec = makeRecording();
    const changed = applyHealing(rec, [
      {
        stepId: 's1',
        stepIndex: 0,
        fallbackIndex: 0,
        attempts: 1,
        winner: cTop,
        originalCandidates: [cTop, cFallback],
      },
    ]);
    expect(changed).toBe(0);
  });

  it('ignores unknown stepIds gracefully', () => {
    const rec = makeRecording();
    const changed = applyHealing(rec, [
      {
        stepId: 'does-not-exist',
        stepIndex: 99,
        fallbackIndex: 1,
        attempts: 2,
        winner: cFallback,
        originalCandidates: [cTop, cFallback],
      },
    ]);
    expect(changed).toBe(0);
  });
});
