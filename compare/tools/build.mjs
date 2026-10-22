// Production builds for every app with Vite, timed:
//   react, vue   → <app>/<impl>/dist   (their own vite.config.js)
//   mini-vite    → <app>/mini/dist     (Mini's source, bundled + minified, to see what no-build costs)
// Mini itself needs no build. Writes results/build.json.

import { build } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const compare = join(import.meta.dirname, '..');
const framework = join(compare, '..', 'framework');
const APPS = ['todo', 'crm', 'bench'];

// Mini's index.html loads 'mini' through an import map and preloads its files; a bundle replaces both.
const stripNoBuildTags = {
  name: 'strip-no-build-tags',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '').replace(/\s*<link rel="modulepreload"[^>]*>/g, ''),
  },
};

function configFor(app, impl) {
  if (impl === 'mini-vite') {
    return {
      configFile: false,
      root: join(compare, app, 'mini'),
      logLevel: 'silent',
      resolve: { alias: { mini: join(framework, 'mini', 'index.js') } },
      plugins: [stripNoBuildTags],
      build: { outDir: 'dist', emptyOutDir: true },
    };
  }
  return { configFile: join(compare, app, impl, 'vite.config.js'), logLevel: 'silent' };
}

const times = {};
for (const app of APPS) {
  for (const impl of ['react', 'vue', 'mini-vite']) {
    const start = performance.now();
    await build(configFor(app, impl));
    const ms = Math.round(performance.now() - start);
    times[`${app}/${impl}`] = ms;
    console.log(`built ${app}/${impl} in ${ms} ms`);
  }
}
mkdirSync(join(compare, 'results'), { recursive: true });
writeFileSync(join(compare, 'results', 'build.json'), JSON.stringify(times, null, 2) + '\n');
