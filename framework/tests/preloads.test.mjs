import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPreloads } from '../tools/preloads.mjs';

// A tiny project: index.html, app/main.js → app/router.js (+ a lazy page), and 'mini' via the import map.
function project(preloads, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mini-preloads-'));
  const files = {
    'index.html': `<!doctype html><head>
  <script type="importmap">{ "imports": { "mini": "/mini/index.js", "mini/extra": "/mini/extra.js" } }</script>
${preloads.map((p) => `  <link rel="modulepreload" href="${p}">`).join('\n')}
  <script type="module" src="/app/main.js"></script>
</head><body><div id="app"></div></body>`,
    'app/main.js': `import { html } from 'mini';\nimport {\n  router,\n} from './router.js';\nimport './components/nav.js';\n// import { x } from './commented-out.js';\n`,
    'app/router.js': `export { thing } from './store.js';\nexport const router = { load: () => import('./pages/lazy.js') };\n`,
    'app/store.js': `export const thing = 1;\n`,
    'app/components/nav.js': `export {};\n`,
    'app/pages/lazy.js': `import { thing } from 'mini/extra';\n`,
    ...extra,
  };
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(join(root, file, '..'), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return root;
}
// Stand-in framework: index.js re-exports from signal.js.
const fw = mkdtempSync(join(tmpdir(), 'mini-fw-'));
writeFileSync(join(fw, 'index.js'), `export { signal } from './signal.js';\n`);
writeFileSync(join(fw, 'signal.js'), `export const signal = 1;\n`);
writeFileSync(join(fw, 'extra.js'), `export const thing = 1;\n`);

const all = ['/mini/index.js', '/mini/signal.js', '/app/main.js', '/app/router.js', '/app/store.js', '/app/components/nav.js'];

test('checkPreloads passes when the preloads are exactly what loads at startup', () => {
  const root = project(all);
  try {
    assert.deepEqual(checkPreloads({ root, mini: fw }), { missing: [], unused: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkPreloads lists startup modules that are not preloaded (static imports only, not lazy pages)', () => {
  const root = project(all.filter((p) => p !== '/mini/signal.js' && p !== '/app/store.js'));
  try {
    assert.deepEqual(checkPreloads({ root, mini: fw }), { missing: ['/mini/signal.js', '/app/store.js'], unused: [] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkPreloads lists preloads nothing loads at startup (a lazy page, a removed file)', () => {
  const root = project([...all, '/app/pages/lazy.js', '/app/gone.js']);
  try {
    assert.deepEqual(checkPreloads({ root, mini: fw }), { missing: [], unused: ['/app/pages/lazy.js', '/app/gone.js'] });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('checkPreloads skips a project whose index.html has no module script', () => {
  const root = project([], { 'index.html': '<!doctype html><body>static</body>' });
  try {
    assert.equal(checkPreloads({ root, mini: fw }).skipped, 'index.html has no <script type="module" src>');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
