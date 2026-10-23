import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromeJobs } from '../tools/chrome.mjs';

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
