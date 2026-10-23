import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { REPLAY_BUDGET, replayScript } from '../tools/replay.mjs';
import { capture } from '../pith/replay.js';

test('replayScript() is a small, valid inline script that calls capture on #app', () => {
  const js = replayScript();
  assert.ok(js.length > 100, `script is only ${js.length} chars`);
  assert.doesNotThrow(() => new Function(js), 'the inline script does not parse');
  assert.match(js, /getElementById\(\s*["'`]app["'`]\s*\)/);
  assert.equal(replayScript(), js, 'the script is built once and reused');
});

// The budget is for the minified script; without Vite (e.g. run from framework/) it's the raw source.
test('replayScript() stays within its 700 byte budget, minified + gzipped', (t) => {
  const js = replayScript();
  if (js === `(${capture})(document.getElementById('app'))`) return t.skip('Vite is not installed in this project, so the script is not minified');
  const size = gzipSync(js, { level: 9 }).length;
  assert.equal(REPLAY_BUDGET, 700);
  assert.ok(size <= REPLAY_BUDGET, `inline replay script is ${size} bytes gzipped, over the ${REPLAY_BUDGET} byte budget`);
});

test('capture() is self-contained (it is inlined on its own) and ignores a missing #app', () => {
  assert.doesNotMatch(String(capture), /\bimport\b|\brequire\(/);
  assert.doesNotThrow(() => capture(null));
});
