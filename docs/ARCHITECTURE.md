# sfdc-recorder — Architecture

## End-to-end flow

```
┌──────────────────────────┐
│ User in Chrome           │
│  - clicks Start in popup │
│  - walks Salesforce flow │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ packages/extension                           │
│   content/index.ts  ─── captures DOM events  │
│   background.ts     ─── per-tab state        │
│   panel/App.tsx     ─── controls + step list │
└────────────┬─────────────────────────────────┘
             │ (uses)
             ▼
┌──────────────────────────────────────────────┐
│ packages/locator-engine                      │
│   captureSnapshot(el) → ElementSnapshot      │
│   - shadowPath (chain of host tags)          │
│   - candidates[] sorted by confidence:       │
│       testId(1.0) > label(0.9) > role(0.85)  │
│         > placeholder(0.7) > text(0.6)       │
│         > relativeXPath(0.15..0.3)           │
└────────────┬─────────────────────────────────┘
             │ (export JSON)
             ▼
┌──────────────────────────────────────────────┐
│ recording.json (the durable artifact)        │
│  - human-editable                            │
│  - Git-friendly                              │
│  - keeps ALL candidates (Phase 2 self-heal)  │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ packages/codegen                             │
│   generateSpec(recording) → Playwright .ts   │
│   - top candidate inlined                    │
│   - fallbacks listed in comments             │
│   - waitForSalesforce auto-injected          │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────┐
│ packages/runner                              │
│   sfdc-rec auth   → save storageState        │
│   sfdc-rec gen    → JSON → spec              │
│   sfdc-rec run    → playwright test ...      │
│   utils/salesforceWaits.ts                   │
└──────────────────────────────────────────────┘
```

## Why a monorepo?

Each package solves one concern and is independently testable/replaceable:

- `locator-engine` is browser-only (no Node deps) — runs both inside the extension and (in Phase 2) inside the Playwright runner for self-healing checks.
- `codegen` is pure (input recording → output string) — easy to unit-test, and we can add other targets later (Cypress, Selenium, Robot Framework).
- `runner` owns Node-only concerns (CLI, child_process, Playwright config).
- `extension` is Chrome-only; isolating it keeps build complexity contained.

## Key non-obvious decisions

1. **Background owns recording state, not content script.** Lightning's SPA navigation tears down content scripts. The service worker survives, so we keep state there.
2. **All locator candidates are persisted, not just the best one.** This is the hook for Phase-2 self-healing: when the top locator fails on a future run, the runner can iterate the list and report which fallback worked.
3. **`composedPath()` for shadow-DOM target resolution.** `event.target` returns the shadow host, not the actual element clicked. `composedPath()[0]` gives us the real target.
4. **Coalescing `input` events.** Without coalescing, typing "Acme Corp" produces 9 steps. With coalescing, it produces 1 step with `value: "Acme Corp"`.
5. **`fullyParallel: false` in Playwright config.** Salesforce orgs throttle concurrent sessions hard; serial runs are more reliable for shared sandboxes.

## Self-healing replay (`sfdc-rec replay --heal`)

Implemented in `packages/runner/src/healing/`. Three pieces:

```
src/healing/
├── resolve.ts   # Walk candidates[] in order. Compile each playwright string
│                # back to a real Locator (whitelisted constructors only —
│                # NOT eval, so a malicious recording can't run code).
├── report.ts    # HealReport aggregates which steps healed and via which
│                # fallback. Logs to console and emits machine-readable JSON.
└── apply.ts     # Mutates the recording JSON in place: promotes the winning
                 # fallback to position 0, but PRESERVES the old top candidate
                 # in the list (audit trail + recovery).
```

The `--heal` switch is intentionally three-valued, not boolean:

- **`off`** (default): top candidate only. First miss fails. Equivalent to a
  vanilla Playwright run. This is what we recommend for CI on `main`.
- **`report`**: walk fallbacks, log + emit report, do **not** modify the
  recording. Best for CI on PRs — reviewer sees drift before approving.
- **`apply`**: walk + persist. The recording JSON is rewritten so the
  surviving candidate becomes the new top. Best for local dev or an explicit
  scheduled "heal recordings" job.

Why the previous top candidate is **not** deleted on `apply`:
1. Salesforce sometimes reverts changes between sandbox refreshes — the old
   locator may come back to life.
2. Diffing the JSON shows what changed, useful for tracking org-wide drift.
3. If the new top later breaks too, the runner can fall further down the list.

## Scaling out (Phase 3+)

- **Visual diff**: capture screenshots in the recorder; compare in the runner with `pixelmatch`.
- **Cloud dashboard**: aggregate `--heal report` JSON across runs to identify
  locators that fail across multiple recordings (org-wide UI changes).
- **CI plugin**: a GitHub Action that takes a folder of `.recording.json` files,
  runs them with `--heal report`, and posts a summary comment to the PR.
