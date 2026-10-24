import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seeOptions } from '../tools/see.mjs';

test('seeOptions: the path, window size and screenshot name for each flag', () => {
  assert.deepEqual(seeOptions(['/team']), { path: '/team', width: 1280, height: 900, mobile: false, dark: false, full: false, state: false, shot: true, name: 'team' });
  assert.deepEqual(seeOptions([]).name, 'home');
  const phone = seeOptions(['/team/1', '--mobile', '--dark', '--full']);
  assert.equal(phone.width, 390);
  assert.equal(phone.height, 844);
  assert.ok(phone.dark && phone.full);
  assert.equal(phone.name, 'team_1-mobile-dark-full');
  assert.equal(seeOptions(['/', '--state', '--no-shot']).shot, false);
  assert.equal(seeOptions(['/', '--state']).state, true);
});
