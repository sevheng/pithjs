import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCES, sourcesText } from '../scripts/examples.mjs';

const dir = join(import.meta.dirname, '..', 'app', 'examples');

test('app/examples/sources.js matches the example files (run npm run examples)', () => {
  assert.equal(readFileSync(SOURCES, 'utf8'), sourcesText(), 'sources.js is out of date: run npm run examples');
});

test('every example file is listed in app/examples/index.js', () => {
  const index = readFileSync(join(dir, 'index.js'), 'utf8');
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'index.js' && f !== 'sources.js')) {
    const name = f.replace(/\.js$/, '');
    assert.match(index, new RegExp(`name: '${name}'`), `${f} isn't in the examples list`);
  }
});
