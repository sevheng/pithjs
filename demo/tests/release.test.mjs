import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dirname, '..', '..');
const read = (...p) => readFileSync(join(repo, ...p), 'utf8');

test('the install commands name the version being released (framework/package.json)', () => {
  const { version } = JSON.parse(read('framework', 'package.json'));
  assert.match(read('demo', 'app', 'brand.js'), new RegExp(`RELEASE = 'v${version.replaceAll('.', '\\.')}'`), 'demo/app/brand.js RELEASE');
  for (const file of ['README.md', 'framework/README.md']) {
    assert.ok(read(file).includes(`v${version}/pithjs-${version}.tgz`), `${file} installs v${version}`);
  }
});
