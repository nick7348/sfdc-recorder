// @ts-check
/**
 * Chrome MV3 build for sfdc-recorder.
 *
 * Why no Vite/CRXJS? The CRXJS Vite plugin pulls rollup@2.x as a transitive
 * dependency, which corporate proxies (e.g. Artifactory) commonly block due
 * to security policy. esbuild has a much cleaner dep tree, builds faster,
 * and we don't need HMR for an unpacked extension (you reload after build).
 */

import { build, context } from 'esbuild';
import { mkdir, rm, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, 'src');
const OUT = resolve(__dirname, 'dist');
const watch = process.argv.includes('--watch');
const isProd = !watch;

/**
 * Mapping from "logical" manifest paths (src-relative, what a human would
 * write) to the built artefact paths in `dist/`.
 *
 * The source manifest.json keeps the readable `src/...` paths so reviewers
 * understand the layout; we rewrite to built paths during the copy.
 */
const PATH_MAP = {
  'src/background.ts': 'background.js',
  'src/content/index.ts': 'content.js',
  'src/panel/index.html': 'panel/index.html',
};

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await mkdir(join(OUT, 'panel'), { recursive: true });

  /** @type {import('esbuild').BuildOptions[]} */
  const configs = [
    {
      entryPoints: [join(SRC, 'background.ts')],
      outfile: join(OUT, 'background.js'),
      format: 'esm',
      target: 'chrome116',
      bundle: true,
      sourcemap: !isProd,
      minify: isProd,
      logLevel: 'info',
    },
    {
      entryPoints: [join(SRC, 'content', 'index.ts')],
      outfile: join(OUT, 'content.js'),
      format: 'iife',
      target: 'chrome116',
      bundle: true,
      sourcemap: !isProd,
      minify: isProd,
      logLevel: 'info',
    },
    {
      entryPoints: [join(SRC, 'panel', 'main.tsx')],
      outfile: join(OUT, 'panel', 'main.js'),
      format: 'esm',
      target: 'chrome116',
      bundle: true,
      sourcemap: !isProd,
      minify: isProd,
      jsx: 'automatic',
      loader: { '.png': 'file', '.svg': 'file' },
      logLevel: 'info',
    },
  ];

  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => context(c)));
    await Promise.all(ctxs.map((c) => c.watch()));
    await copyStaticAssets();
    await emitManifest();
    console.log('[sfdc-recorder] Watching for changes…');
    // Also re-emit static assets/manifest on rebuilds. esbuild's watch emits
    // JS only — we run a polling loop for HTML/CSS/manifest.
    setInterval(() => {
      copyStaticAssets().catch((err) => console.error('static copy failed:', err));
    }, 1500);
  } else {
    await Promise.all(configs.map((c) => build(c)));
    await copyStaticAssets();
    await emitManifest();
    console.log('[sfdc-recorder] Build complete →', OUT);
  }
}

async function copyStaticAssets() {
  const panelSrc = join(SRC, 'panel');
  const panelOut = join(OUT, 'panel');
  await mkdir(panelOut, { recursive: true });

  const assets = ['index.html', 'styles.css'];
  for (const name of assets) {
    const from = join(panelSrc, name);
    if (!existsSync(from)) continue;
    let contents = await readFile(from, 'utf8');
    if (name === 'index.html') {
      // The source HTML references `./main.tsx`. Rewrite to the built JS so
      // Chrome can load it directly without TS compilation.
      contents = contents
        .replace(/\.\/main\.tsx/g, './main.js')
        .replace(/<script type="module" src="\.\/main\.js"><\/script>/, (m) => m); // noop, kept for clarity
    }
    await writeFile(join(panelOut, name), contents, 'utf8');
  }

  // Optional icons: copy any PNGs from src/icons/ if the directory exists.
  const iconsSrc = join(SRC, 'icons');
  if (existsSync(iconsSrc)) {
    const iconsOut = join(OUT, 'icons');
    await mkdir(iconsOut, { recursive: true });
    for (const f of await readdir(iconsSrc)) {
      if (f.endsWith('.png') || f.endsWith('.svg')) {
        await copyFile(join(iconsSrc, f), join(iconsOut, f));
      }
    }
  }
}

async function emitManifest() {
  const manifestPath = resolve(__dirname, 'manifest.json');
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);

  // Rewrite src/ paths to built dist-relative paths.
  if (manifest.background?.service_worker) {
    manifest.background.service_worker = remap(manifest.background.service_worker);
  }
  if (Array.isArray(manifest.content_scripts)) {
    for (const cs of manifest.content_scripts) {
      if (Array.isArray(cs.js)) cs.js = cs.js.map(remap);
      if (Array.isArray(cs.css)) cs.css = cs.css.map(remap);
    }
  }
  if (manifest.action?.default_popup) {
    manifest.action.default_popup = remap(manifest.action.default_popup);
  }
  if (manifest.icons) {
    // Icons paths are already user-supplied; keep as-is.
  }

  await writeFile(
    join(OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  );
}

/** @param {string} p */
function remap(p) {
  return PATH_MAP[p] ?? p;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
