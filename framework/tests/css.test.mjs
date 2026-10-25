import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The build's CSS minifier (Lightning CSS, in Vite) keeps only the last of `x` and `-webkit-x` in a rule, and adds
// the prefix back itself for the browsers that need it. So the standard property must come last, or a production
// build loses it (seen: the frosted header's backdrop-filter, gone in Chrome on the published demo).
test('the starter CSS writes a -webkit- property before its standard one, so a build keeps both', () => {
  const css = readFileSync(join(import.meta.dirname, '..', 'template', 'styles', 'main.css'), 'utf8');
  const wrong = [...css.matchAll(/(?<![-\w])([a-z][a-z-]*)\s*:[^;{}]*;\s*-webkit-\1\s*:/g)].map((m) => m[0].slice(0, 60));
  assert.deepEqual(wrong, []);
});
