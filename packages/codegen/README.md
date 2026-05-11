# @sfdc-recorder/codegen

Converts a `.recording.json` (produced by the extension) into a Playwright TypeScript spec file.

## Generated output style

```typescript
test('create-account-with-contact', async ({ page }) => {
  await page.goto('https://my.lightning.force.com/lightning/o/Account/new');
  await waitForSalesforce(page);

  // Step 1: click button "New"
  await page.getByRole('button', { name: 'New' }).click();
  // fallbacks (decreasing confidence):
  //   - page.getByText("New", { exact: true })   // visible text "New"

  // Step 2: type "Acme Corp" into field labelled "Account Name"
  await page.getByLabel('Account Name', { exact: true }).fill('Acme Corp');
  // ...
});
```

Notable design choices:

- **Top candidate inlined** for clean, readable code.
- **Fallbacks listed in comments** so an SDET can swap manually when something breaks (and so Phase-2 self-healing has a place to look).
- **Salesforce-aware waits** auto-injected after navigations (uses `waitForSalesforce` from `@sfdc-recorder/runner`).
- **Step numbers in comments** so when a test fails on "Step 7" you know exactly where to look.
