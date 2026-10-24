import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DATA, benchmarksText, hasCompare } from '../scripts/benchmarks.mjs';

test('app/data/benchmarks.js matches ../compare/results/measure.json (run npm run benchmarks)',
  { skip: hasCompare() ? false : 'no ../compare folder' }, () => {
    assert.equal(readFileSync(DATA, 'utf8'), benchmarksText(), 'benchmarks.js is out of date: run npm run benchmarks');
  });
