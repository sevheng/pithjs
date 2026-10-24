import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const framework = join(import.meta.dirname, '..');
const cli = join(framework, 'tools', 'cli.mjs');
const pith = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('package.json makes the framework the pithjs package, with the pith command', () => {
  const pkg = JSON.parse(readFileSync(join(framework, 'package.json'), 'utf8'));
  assert.equal(pkg.name, 'pithjs');
  assert.equal(pkg.bin.pith, 'tools/cli.mjs');
  assert.equal(pkg.exports['.'], './pith/index.js');
  assert.equal(pkg.exports['./testing'], './tests/harness.js');
  for (const dir of ['pith', 'tools', 'tests', 'docs', 'template', 'skills', 'AGENTS.md']) assert.ok(pkg.files.includes(dir), `files misses ${dir}`);
  assert.match(readFileSync(cli, 'utf8'), /^#!\/usr\/bin\/env node\n/);
});

test('pith with no command lists every command', () => {
  const out = pith();
  assert.equal(out.status, 0);
  for (const cmd of ['create', 'dev', 'serve', 'build', 'preview', 'check', 'see', 'new']) {
    assert.match(out.stdout, new RegExp(`\\n  ${cmd}\\b`), `help misses ${cmd}`);
  }
});

test('pith runs the tool for a command, passing its arguments and exit code', () => {
  const out = pith('new');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /usage: .*new page <name>/);
});

test('pith names an unknown command and exits 1', () => {
  const out = pith('deploy');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /Unknown command "deploy"/);
});
