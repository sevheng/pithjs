import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBase, baseArg } from '../tools/dev-server.mjs';
import { addBase } from '../tools/vite-plugin.mjs';

test('pith build --base: any spelling becomes /name/, and no --base is /', () => {
  for (const v of ['/pithjs', 'pithjs/', '/pithjs/', 'pithjs']) assert.equal(normalizeBase(v), '/pithjs/');
  assert.equal(normalizeBase('/a/b'), '/a/b/');
  for (const v of ['/', '', undefined]) assert.equal(normalizeBase(v), '/');
  assert.equal(baseArg(['build', '--base', 'pithjs']), '/pithjs/');
  assert.equal(baseArg(['build']), '/');
});

test('the built page tells Pith its base in <meta name="pith-base">, only when there is one', () => {
  const html = '<!doctype html><html><head><title>x</title></head></html>';
  assert.equal(addBase(html, '/'), html);
  assert.match(addBase(html, '/pithjs/'), /<head>\s*<meta name="pith-base" content="\/pithjs\/">/);
});
