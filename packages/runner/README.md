# @sfdc-recorder/runner

CLI for the sfdc-recorder workflow:

```
sfdc-rec auth     # log into Salesforce once, save session
sfdc-rec gen      # convert .recording.json → Playwright .spec.ts
sfdc-rec run      # run a spec with Salesforce-tuned Playwright config
sfdc-rec replay   # replay .recording.json directly (with self-healing)
```

## Self-healing locators (`replay --heal`)

Recordings store **all** locator candidates per step (sorted by confidence). The replay engine can fall back through them when the top candidate breaks — useful after a Salesforce release re-renders the DOM.

The behavior is controlled by an explicit switch (off by default — silent self-healing is dangerous):

| Mode | Behavior |
|---|---|
| `--heal off` (default) | Top candidate only. First miss fails the run. Same as a vanilla Playwright run. |
| `--heal report` | Walk fallbacks, log which one worked, **don't** modify the recording. Best for CI: drift is visible, humans approve fixes. |
| `--heal apply` | Walk fallbacks AND rewrite the recording so the surviving candidate becomes the new top. Best for local dev / explicit "fix the recording" runs. |

Examples:

```bash
# Strict — same as plain Playwright. Fails fast.
sfdc-rec replay ./recordings/create-account.recording.json

# CI mode — see drift, don't auto-modify.
sfdc-rec replay ./recordings/create-account.recording.json \
  --heal report \
  --report-json ./heal-report.json

# Local dev — heal and persist.
sfdc-rec replay ./recordings/create-account.recording.json --heal apply --headed
```

When `--heal apply` succeeds, the recording JSON is reordered (the winning candidate moves to position 0). The previous top candidate is **not deleted** — only re-ranked — so you preserve the audit trail and can recover if Salesforce reverts a change. A timestamped `[auto-healed YYYY-MM-DD]` comment is added to the step.

## Salesforce-aware waits

Importing `waitForSalesforce` adds three guards on top of Playwright's default `networkidle`:

1. Wait for Lightning's Aura initialization (`[data-aura-rendered-by]`).
2. Wait for the global SLDS spinner to disappear.
3. A short settling delay for async LWC re-renders.

Generated specs call this automatically after navigations.

## Session reuse

```bash
sfdc-rec auth --url https://my.lightning.force.com --output ./session.json
# (browser opens — log in with MFA — press Enter)

sfdc-rec run tests/create-account.spec.ts --storage-state ./session.json
```

The session JSON is `.gitignore`d by default — never commit your session.

## Playwright config

The bundled `playwright.config.ts` sets Salesforce-friendly timeouts (long actions, longer navigation), enables traces/screenshots on failure, and disables `fullyParallel` (Salesforce orgs throttle concurrent sessions).
