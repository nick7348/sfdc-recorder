# Locator strategy

The single most important design decision in this project. Here's the reasoning.

## The Salesforce locator problem

| Anti-pattern | Why it breaks |
|---|---|
| `#combobox-button-123` | IDs are auto-generated per render. Change every page load. |
| `div > div > span:nth-of-type(3)` | DOM shifts on every Lightning release. |
| `[data-aura-rendered-by="42:abc"]` | Aura render IDs are session-scoped. Useless across runs. |
| Absolute XPath | Worst of all worlds — order-sensitive AND deeply nested. |

## What we use instead, in priority order

### 1. `testId` (confidence 1.0)
Looks for `data-testid`, `data-test`, `data-qa`, `data-cy`, `data-id`. If your team owns the org's customizations, you can add these to your custom Lightning components — and we strongly recommend it for any flow you plan to automate long-term.

### 2. `label` (confidence 0.9)
Salesforce form fields have stable labels (admins rarely change a field's label without a major refactor). We resolve the label via, in order:
1. `aria-label` or `label` attribute (LWC `<lightning-input label="...">`)
2. `<label for="id">` matching by ID
3. Wrapping `<label>` ancestor (deep-traversed across shadow boundaries)

### 3. `ariaRole` (confidence 0.85)
`getByRole('button', { name: 'Save' })` — very stable for buttons, links, comboboxes, checkboxes. Salesforce LWC components mostly have correct ARIA semantics.

### 4. `placeholder` (confidence 0.70)
Useful for search boxes and lookup fields where the label might be visually hidden.

### 5. `text` (confidence 0.60)
`getByText('Save', { exact: true })` for clickable text spans, links, etc. We only use *direct* text (not concatenated descendant text) to avoid noisy matches.

### 6. `relativeXPath` (confidence 0.15–0.30)
**Last resort.** We always try to anchor on a semantic ancestor (something with `data-*`, `aria-label`, `role`, or `name`). Unanchored XPath gets a confidence of 0.15 — included only because *some* fallback is better than none.

## Why we keep ALL candidates in the recording

This is the critical Phase-2 hook.

When a top locator fails on a future run, the runner walks the `candidates[]` array:

```typescript
async function resolve(page, candidates) {
  for (const c of candidates) {
    const el = await page.$(c.playwright);
    if (el && (await el.isVisible())) return { el, used: c };
  }
  throw new Error('No candidate matched');
}
```

If a fallback worked, we record the fact and:

1. **Tell the SDET** in the test report: *"Step 3 used fallback `getByLabel('Type')` because `getByRole('combobox', { name: 'Type' })` no longer matches."*
2. **Auto-update the recording JSON** to promote the fallback (gated behind a `--auto-heal` flag).

This turns Salesforce's release cadence from a recurring chore into a one-line CI output.

## Things we deliberately do NOT use

- **`page.locator('#button-123')`** — auto-generated IDs.
- **`page.locator('lightning-button:nth-child(3)')`** — order-sensitive.
- **`page.locator('[data-aura-rendered-by]')`** — session-scoped.
- **CSS class selectors like `.slds-button_brand`** — not unique; Salesforce uses these for styling, not identity.

## What an SDET should know when editing locators

- Locators are stored in `candidates[]` sorted by confidence DESC.
- The codegen always uses `candidates[0]` as the top locator. If you want to swap, edit the recording JSON to reorder the array, then regenerate.
- The `description` field on each candidate is for human-readable comments in the generated test. Edit freely.
