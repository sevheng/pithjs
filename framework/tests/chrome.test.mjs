import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromeJobs, retryFailures } from '../tools/chrome.mjs';

test('chromeJobs: a quarter of the cores on a quiet machine, fewer as it gets busy, at least 1', () => {
  assert.equal(chromeJobs({ cores: 16, load: 0, env: '' }), 4);
  assert.equal(chromeJobs({ cores: 16, load: 8, env: '' }), 2);
  assert.equal(chromeJobs({ cores: 16, load: 40, env: '' }), 1);
  assert.equal(chromeJobs({ cores: 4, load: 0, env: '' }), 2);
  assert.equal(chromeJobs({ cores: 4, load: 3, env: '' }), 1);
  assert.equal(chromeJobs({ cores: 64, load: 2, env: '' }), 16);
});

test('chromeJobs: PITH_CHROME_JOBS wins', () => {
  assert.equal(chromeJobs({ cores: 16, load: 40, env: '6' }), 6);
});

test('retryFailures: runs each failed item once more; a pass the second time counts, marked as retried', async () => {
  const tries = { a: 0, b: 0, c: 0 };
  const results = await retryFailures(['a', 'b', 'c'], async (item) => {
    tries[item]++;
    return { item, ok: item === 'a' || (item === 'b' && tries.b === 2) };
  });
  assert.deepEqual(tries, { a: 1, b: 2, c: 2 }, 'only failures run again, once');
  assert.deepEqual(results.map((r) => [r.item, r.ok, !!r.retried]), [['a', true, false], ['b', true, true], ['c', false, true]]);
});
