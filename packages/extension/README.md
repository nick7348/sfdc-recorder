# @sfdc-recorder/extension

Chrome MV3 extension that records Salesforce flows. Uses `@sfdc-recorder/locator-engine` to capture stable, layered locators for every interaction.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Salesforce tab                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Content script (src/content/index.ts)                    │   │
│  │  - capture: click/input/change/keydown via composedPath  │   │
│  │  - calls captureSnapshot(el) from locator-engine         │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────┼────────────────────────────────────┘
                              │ chrome.runtime.sendMessage
┌─────────────────────────────▼────────────────────────────────────┐
│  Background service worker (src/background.ts)                   │
│  - per-tab state machine: idle | recording | paused              │
│  - coalesces consecutive `input` events on the same field        │
│  - handles SPA navigation (chrome.tabs.onUpdated)                │
└─────────────────────────────┬────────────────────────────────────┘
                              │ chrome.runtime.sendMessage
┌─────────────────────────────▼────────────────────────────────────┐
│  Popup panel (src/panel/App.tsx — React)                         │
│  - Start / Pause / Resume / Stop                                 │
│  - Live step list                                                │
│  - Export to .recording.json                                     │
└──────────────────────────────────────────────────────────────────┘
```

## Building

```bash
pnpm --filter @sfdc-recorder/extension build      # one-shot
pnpm --filter @sfdc-recorder/extension dev        # watch mode
```

Outputs `dist/` — load it in Chrome via `chrome://extensions` → Developer mode → Load unpacked → select `packages/extension/dist`.

The build is a small `node build.mjs` script using **esbuild** (no Vite, no CRXJS). This was an intentional choice for two reasons:

1. **Corporate proxies** (Artifactory, Nexus) often block old transitive dependencies. CRXJS pulled `rollup@2.x` which is commonly blocked. esbuild has a clean dep tree.
2. **Extensions don't really need HMR** — you have to reload the unpacked extension after every change anyway. Watch-mode rebuild is plenty.

The build script:
- Bundles `background.ts` (ESM, MV3 service worker)
- Bundles `content/index.ts` (IIFE, content script)
- Bundles `panel/main.tsx` (ESM, popup React app)
- Copies `panel/index.html` and `panel/styles.css`
- Reads source `manifest.json` and rewrites `src/...` paths → built artefact paths
- Optionally copies `src/icons/*.png` if you add them

## Notes for SDETs

- **Icons**: the manifest currently has no icon block, so Chrome shows a default puzzle icon. To brand it, add an `icons` section back to `manifest.json` pointing at PNGs you drop into `src/icons/`.
- **All frames**: the content script runs in iframes too (Visualforce pages live in iframes).
- **Shadow DOM**: handled via `composedPath()` + the `locator-engine` shadow walker.
- **Coalescing**: typing into a single field produces ONE `input` step with the final value, not 30 keystrokes.
