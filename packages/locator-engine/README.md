# @sfdc-recorder/locator-engine

Salesforce-aware locator builder. Given a DOM element captured by the recorder, produces a ranked list of candidate locators that work in Playwright.

## Strategy ranking

| Strategy | Confidence | When it applies |
|---|---|---|
| `testId` | 1.00 | Element has `data-testid`, `data-test`, `data-qa`, or `data-cy` |
| `label` | 0.90 | Form field with a resolvable label (incl. `<lightning-input label="...">`) |
| `ariaRole` | 0.85 | Element has implicit/explicit role + accessible name |
| `placeholder` | 0.70 | Input with non-empty `placeholder` |
| `text` | 0.60 | Element has direct (non-descendant) text content ≤ 120 chars |
| `relativeXPath` | 0.15–0.30 | Anchored on a semantic ancestor (last resort) |

## Why we keep ALL candidates

The recording stores every candidate, sorted by confidence. This buys us:

1. **Today**: codegen picks the top candidate for clean test code.
2. **Tomorrow (Phase 2)**: when a top locator fails on a future run, the runner walks the candidate list to self-heal — and reports which fallback worked, so we can update locators automatically.

## Shadow DOM

Lightning components are deeply nested in shadow roots. `deepQuerySelector` and `deepClosest` traverse them. Each snapshot also stores a `shadowPath` (chain of host tag names) so the runner can verify it's still in the same component when self-healing.
