// The inline script prerendered pages carry, built from mini/replay.js: it holds clicks and typed text
// made before the app starts, and replays them on the live app (see capture() there).
// Minified with the project's Vite (synchronously, so injectPage can call it as a default), or the raw
// source if Vite isn't installed. Built once per process.

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { capture } from '../mini/replay.js';
import { projectRoot } from './dev-server.mjs';

export const REPLAY_BUDGET = 700; // bytes, minified + gzipped

/** @type {string | undefined} */
let cached;

/** @returns {string} JS for an inline <script>, or '' for none */
export function replayScript() {
  if (cached !== undefined) return cached;
  const source = `(${capture})(document.getElementById('app'))`;
  try {
    const { minifySync } = createRequire(join(projectRoot, 'package.json'))('vite');
    const out = minifySync('replay.js', source, { compress: true, mangle: true });
    cached = !out.errors?.length && out.code ? out.code.trim() : source;
  } catch {
    cached = source;
  }
  return cached;
}

/** Bytes of the inline script, gzipped: build.mjs can print it. */
export const replayScriptSize = () => gzipSync(replayScript(), { level: 9 }).length;
