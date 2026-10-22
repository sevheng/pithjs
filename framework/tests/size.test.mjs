import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, measureFramework } from '../tools/size.mjs';

test('the core framework is measured minified + gzipped, and stays within its 10 KB budget', async (t) => {
  const size = await measureFramework();
  if (size.skipped) return t.skip(size.skipped);
  assert.equal(BUDGET, 10_000);
  assert.ok(size.core > 4_000, `core measured at ${size.core} bytes: too small to be the whole framework`);
  assert.ok(size.core <= BUDGET, `core is ${size.core} bytes gzipped, over the ${BUDGET} byte budget`);
});
