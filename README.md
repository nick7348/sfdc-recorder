# sfdc-recorder

A purpose-built Salesforce test automation toolkit: a Chrome extension that records user-story flows and auto-generates **Playwright** test scripts. Designed for SDETs who want to skip the boilerplate of writing Salesforce locators by hand.

## Why this exists

Salesforce automation is hard:

- Lightning Web Components hide everything behind Shadow DOM
- IDs are auto-generated and change every render (`button-123`, `lightning-input-456`)
- 3 release cycles per year regularly shift the DOM
- Generic recorders (Selenium IDE, Playwright Codegen) produce brittle scripts

`sfdc-recorder` solves this with:

- **Salesforce-aware locators** — a layered strategy (test ids → labels → ARIA → relative XPath)
- **Shadow DOM piercing** — the recorder walks shadow roots correctly
- **Lightning + Classic detection** — picks the right strategy per page
- **Editable, readable output** — generates clean Playwright TypeScript, not opaque blobs

## Packages

This is a pnpm monorepo. See each package for details.


| Package                                                      | Description                                         |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `[@sfdc-recorder/extension](./packages/extension)`           | Chrome MV3 extension — the recorder UI              |
| `[@sfdc-recorder/locator-engine](./packages/locator-engine)` | Salesforce-aware locator builder (Shadow DOM aware) |
| `[@sfdc-recorder/codegen](./packages/codegen)`               | Recording JSON → Playwright `.spec.ts`              |
| `[@sfdc-recorder/runner](./packages/runner)`                 | CLI for replaying recordings + managing sessions    |


## Quick start

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Load the extension in Chrome:
#   1. chrome://extensions
#   2. Enable Developer mode
#   3. Click "Load unpacked"
#   4. Select packages/extension/dist
```

## Recording a user story

1. Click the `sfdc-recorder` extension icon
2. Hit **Start Recording**
3. Walk through your user story in Salesforce
4. Hit **Stop** — exports a `.recording.json`
5. (Optional) edit the steps inline in the panel — rename, reorder, delete, comment
6. Generate a Playwright test:

```bash
pnpm sfdc-rec gen ./my-story.recording.json -o tests/my-story.spec.ts
```

1. Run it:

```bash
pnpm sfdc-rec run tests/my-story.spec.ts
```

## Replay with self-healing (the locator-stability story)

Recordings store **all** locator candidates per step (sorted by confidence). When Salesforce's DOM shifts after a release, the replay engine can fall back through the list:

```bash
# Strict — top candidate only. CI-safe default.
pnpm sfdc-rec replay ./recordings/create-account.recording.json --heal off

# Discover drift without modifying anything (great for CI).
pnpm sfdc-rec replay ./recordings/create-account.recording.json \
  --heal report --report-json ./drift.json

# Heal AND persist — survivor candidate becomes the new top.
pnpm sfdc-rec replay ./recordings/create-account.recording.json --heal apply
```

The previous top candidate is never deleted — only re-ranked — so you preserve the audit trail and can recover if Salesforce reverts a UI change.

## Roadmap

- **Phase 1 (MVP)**: Recorder + Codegen + Runner + Inline step editor
- **Phase 2**: Self-healing locators with `--heal off|report|apply` switch
- **Phase 3 (v2 schema)**: Iframe support · Salesforce field-type intelligence (picklist / multi-picklist / lookup / combobox / date / checkbox / file upload) · Robustness pack (toast/modal/spinner waits + retry-on-stale) · Assertion mode in recorder · Sub-flow groups · JSON data fixtures with `$VAR` substitution
- **Phase 4**: Visual regression + screenshot-per-step diffing
- **Phase 5**: Cloud dashboard + team-shared healing telemetry
- **Phase 6**: CI/CD plugins (GitHub Actions, Azure Pipelines, Jenkins)

## v2 highlights

### Assertions

Click the **✓ Assert mode** button in the panel during recording. Every click in this mode becomes an `assertVisible` step instead of a `click`. Typing into a field in assert mode becomes `assertValue`. Toggle off to return to action recording.

The codegen emits `expect(...)` calls that match Playwright's standard assertion API.

### Sub-flow groups

Click **+ Group**, name it (e.g. `login`), record common steps, then click **End group**. All steps inside the group end up tagged with `groupId`. The codegen emits a named TypeScript function:

```typescript
async function login(page: Page): Promise<void> {
  await page.getByLabel('Username').fill('user@example.com');
  // ...
}

test('create-account-with-login', async ({ page }) => {
  await login(page);
  // ... rest of the flow
});
```

### Data fixtures

Type `$VAR_NAME` in any input value or assertion text during recording. The schema picks them up automatically. Then at runtime:

```bash
# fixtures.json
{ "ACCOUNT_NAME": "Acme Corp", "ACCOUNT_TYPE": "Customer" }

pnpm sfdc-rec replay .\my-flow.recording.json --fixtures .\fixtures.json
# OR generate a parameterized spec:
pnpm sfdc-rec gen .\my-flow.recording.json --parameterize -o tests/my-flow.spec.ts
```

### Robustness flags (automatic, no flag needed)

- `waitForToast` after Save-style buttons (auto-detected from the comment "save / submit / create / delete")
- `waitForModalOpen` if the step comment mentions "opens modal"
- `withStaleRetry` wrapper on every action — retries up to 3× on Lightning re-render races

### Iframe support

The recorder now captures the frame chain (URL + name) for each interaction. Generated tests use `page.frameLocator('iframe[name="..."]').frameLocator(...)` chains. Replay walks the chain automatically.

This unlocks Salesforce Classic, Visualforce pages, and most AppExchange components that embed via iframes.

## Testing

```bash
pnpm test            # runs vitest in every package that has tests
pnpm typecheck       # strict tsc across the workspace
pnpm lint            # eslint
```

## License

MIT



## Quick start

git clone [https://github.com/nick7348/sfdc-recorder.git](https://github.com/nick7348/sfdc-recorder.git)

cd sfdc-recorder

pnpm install

pnpm build

pnpm sfdc-rec --help