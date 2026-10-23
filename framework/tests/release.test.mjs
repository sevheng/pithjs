import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RELEASE_FILE, checkRelease, forDeploy } from '../tools/release.mjs';
import * as source from '../pith/index.js';

const release = () => readFileSync(RELEASE_FILE, 'utf8');

test('pith.min.js is one file with no imports, exporting everything pith/index.js exports', async () => {
  assert.doesNotMatch(release(), /\bimport\s*[\s{*'"]|\bimport\(/);
  const built = await import(`data:text/javascript,${encodeURIComponent(release())}`);
  assert.deepEqual(Object.keys(built).sort(), Object.keys(source).sort());
});

// Thrown errors (E0xx) stay, with their docs link: they're real failures, in production too.
test('pith.min.js has no dev-only code (warnings, the state registry)', () => {
  const code = release();
  for (const devOnly of ['__pith', 'console.warn', 'W001', 'W012']) assert.ok(!code.includes(devOnly), `found ${devOnly}`);
});

test('pith.min.js is up to date with pith/*.js', async (t) => {
  const result = await checkRelease();
  if (result.skipped) return t.skip(result.skipped);
  assert.ok(result.ok, 'pith.min.js is stale: run node framework/tools/release.mjs');
});

test('forDeploy points the import map at pith.min.js and preloads just it, instead of every Pith file', () => {
  const page = `<head>
  <script type="importmap">{ "imports": { "pith": "/pith/index.js" } }</script>
  <link rel="modulepreload" href="/pith/index.js">
  <link rel="modulepreload" href="/pith/signal.js">
  <link rel="modulepreload" href="/app/main.js">
  <script type="module" src="/app/main.js"></script>
</head>`;
  assert.equal(
    forDeploy(page),
    `<head>
  <script type="importmap">{ "imports": { "pith": "/pith/pith.min.js" } }</script>
  <link rel="modulepreload" href="/pith/pith.min.js">
  <link rel="modulepreload" href="/app/main.js">
  <script type="module" src="/app/main.js"></script>
</head>`
  );
});
