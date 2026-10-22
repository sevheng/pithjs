// npm run build: a production build of a Mini project with Vite, into dist/.
//   - bundles each page with its imports (no import waterfall) and minifies everything
//   - removes code the app doesn't use (e.g. the router in a one-page app)
//   - fingerprints file names (app-3f9a1c.js), so browsers can cache them forever
//   - turns Mini's dev warnings off at build time, so their code is dropped too
//   - prerenders each fixed route to dist/<route>/index.html with headless Chrome (see prerender.mjs),
//     so pages show before JS runs. --no-prerender skips it (it's also skipped if Chrome isn't found).
// Development stays build-free (npm run dev). Vite is only needed here:
//   npm install --save-dev vite
// Deploy dist/ to any static host, with "unknown paths → 404.html" (SPA fallback) turned on.
// (404.html is the plain app shell; index.html works too, but shows the home page until JS loads.)

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { projectRoot } from './dev-server.mjs';
import { mini } from './vite-plugin.mjs';

// Load Vite from the project (it's the project's dev dependency, not the framework's).
async function loadVite() {
  try {
    const require = createRequire(join(projectRoot, 'package.json'));
    return await import(require.resolve('vite'));
  } catch {
    console.error('✗ Vite is not installed in this project. Run:  npm install --save-dev vite');
    process.exit(1);
  }
}

/**
 * Build the project in `root` into `root/dist`, then prerender its routes. Returns the build time in ms.
 * @param {{ root?: string, quiet?: boolean, prerender?: boolean, onPrerender?: (result: any) => void }} [options]
 *   onPrerender: gets prerender()'s result (pages written, redirected routes, warnings)
 */
export async function buildProject({ root = projectRoot, quiet = false, prerender = true, onPrerender } = {}) {
  if (!existsSync(join(root, 'index.html'))) throw new Error(`No index.html in ${root}: run this from a Mini project folder.`);
  const { build } = await loadVite();
  const start = performance.now();
  const result = await build({
    configFile: false,
    root,
    logLevel: quiet ? 'silent' : 'info',
    define: { 'globalThis.MINI_DEV': 'false' },
    plugins: [mini({ projectRoot: root })],
    build: { outDir: 'dist', emptyOutDir: true },
  });
  if (prerender) {
    const { prerender: run } = await import('./prerender.mjs');
    const chunks = [result].flat().flatMap((r) => ('output' in r ? r.output : [])).filter((c) => c.type === 'chunk');
    const done = await run({ root, chunks });
    onPrerender?.(done);
    if (!quiet) {
      if (done.skipped) console.log(`– Prerender skipped: ${done.skipped}`);
      else {
        const { replayScriptSize } = await import('./replay.mjs');
        console.log(`✓ Prerendered ${done.pages.length} page${done.pages.length === 1 ? '' : 's'}: ${done.pages.map((p) => p.file).join(', ')}`);
        console.log(`  + ${replayScriptSize()} B inline script per page (keeps clicks made before the app starts)`);
      }
      for (const w of done.warnings) console.warn(w);
    }
  }
  return Math.round(performance.now() - start);
}

if (import.meta.main) {
  const ms = await buildProject({ prerender: !process.argv.includes('--no-prerender') });
  console.log(`\n✓ Built ${join(projectRoot, 'dist')} in ${ms} ms. Try it: npm run preview`);
}
