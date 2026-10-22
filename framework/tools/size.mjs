// Mini's size budget: the whole core ('mini', every export) built for production, minified and gzipped,
// must stay within 10 KB. Measured like `npm run build` (dev warnings stripped), but with nothing
// tree-shaken away, so it's the most any app can ship.
// Used by check.mjs; needs the project's Vite (skipped without it).

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { projectRoot } from './dev-server.mjs';

export const BUDGET = 10_000; // bytes, minified + gzipped

const mini = join(import.meta.dirname, '..', 'mini');

/**
 * @param {{ root?: string }} [options] root: a project folder with Vite installed
 * @returns {Promise<{ core: number, skipped?: undefined } | { skipped: string }>}
 */
export async function measureFramework({ root = projectRoot } = {}) {
  let vite;
  try {
    vite = await import(createRequire(join(root, 'package.json')).resolve('vite'));
  } catch {
    return { skipped: 'Vite is not installed in this project (npm install)' };
  }
  const gzipped = async (entry) => {
    const out = await vite.build({
      configFile: false,
      logLevel: 'silent',
      define: { 'globalThis.MINI_DEV': 'false' },
      build: {
        write: false,
        minify: true,
        rollupOptions: { input: join(mini, entry), preserveEntrySignatures: 'strict' },
      },
    });
    const code = [out].flat().flatMap((r) => r.output).filter((c) => c.type === 'chunk').map((c) => c.code).join('\n');
    return gzipSync(code, { level: 9 }).length;
  };
  const core = await gzipped('index.js');
  return { core };
}
