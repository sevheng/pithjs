// Checks index.html's <link rel="modulepreload"> list against what the app really loads at startup:
// the entry <script type="module" src> and everything it imports statically (import maps resolved,
// lazy import() pages left out). Without a build, a missing preload costs a network round trip,
// because the browser only finds the file after the file importing it has arrived; an unused one
// downloads code the page doesn't need. Used by check.mjs.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { projectRoot } from './dev-server.mjs';

// Static `import ... from '...'`, `export ... from '...'` and `import '...'`, at the start of a line
// (so commented-out imports don't count). Dynamic import() is lazy and left out.
const STATIC_IMPORT = /^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;

/**
 * @param {{ root?: string, pith?: string }} [options] pith: the framework folder served at /pith/
 * @returns {{ missing: string[], unused: string[], skipped?: undefined } | { skipped: string }}
 */
export function checkPreloads({ root = projectRoot, pith = join(import.meta.dirname, '..', 'pith') } = {}) {
  const indexFile = join(root, 'index.html');
  if (!existsSync(indexFile)) return { skipped: 'no index.html in this folder' };
  const page = readFileSync(indexFile, 'utf8');
  const entry = page.match(/<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/)?.[1];
  if (!entry) return { skipped: 'index.html has no <script type="module" src>' };
  const imports = JSON.parse(page.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] || '{}').imports ?? {};
  const preloads = [...page.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*\bhref="([^"]+)"/g)].map((m) => m[1]);

  const fileOf = (url) => (url.startsWith('/pith/') ? join(pith, url.slice('/pith/'.length)) : join(root, url));
  const loaded = new Set();
  const visit = (url) => {
    if (loaded.has(url) || !existsSync(fileOf(url))) return;
    loaded.add(url);
    for (const m of readFileSync(fileOf(url), 'utf8').matchAll(STATIC_IMPORT)) {
      const spec = m[1] ?? m[2];
      const next = imports[spec] ?? (spec.startsWith('.') ? posix.join(dirname(url), spec) : spec.startsWith('/') ? spec : null);
      if (next) visit(next);
    }
  };
  visit(entry);
  return {
    missing: [...loaded].filter((url) => !preloads.includes(url)),
    unused: preloads.filter((url) => !loaded.has(url)),
  };
}
