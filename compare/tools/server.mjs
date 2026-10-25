// Production-like server for comparisons: serves one app + framework, gzip-compressed, over
// HTTP/1.1 (http://) or HTTP/2 (https://, local self-signed cert). Code every implementation shares (the
// trading feed, the formula engine) is served from shared/ at /shared/.
//
//   node tools/server.mjs <app> <impl> [--h2] [--port 8000]
//   app:  trade | sheet          impl: pith | react | vue | pith-vite
//
// pith is served from source (no build step, as Pith is meant to run); react and vue are served
// from their Vite production builds (dist/), as they are meant to run. pith-vite is Pith's source
// bundled and minified by Vite (tools/build.mjs), to show what skipping the build costs.
// --deploy (deploy: true) serves pith as a no-build site is deployed: index.html loads Pith's one-file
// production copy, pith/pith.min.js (framework/tools/release.mjs), instead of its dev sources.

import http from 'node:http';
import http2 from 'node:http2';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { forDeploy } from '../../framework/tools/release.mjs';

const compare = join(import.meta.dirname, '..');
const framework = join(compare, '..', 'framework');
export const APPS = ['trade', 'sheet'];
// pith-before: the same Pith app on a copy of an older pith/ in .pith-before/, for tools/ab.mjs.
export const IMPLS = ['pith', 'react', 'vue', 'pith-vite', 'pith-before'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);

/** Where an implementation's files are served from. */
export function appRoot(app, impl) {
  if (impl === 'pith' || impl === 'pith-before') return join(compare, app, 'pith');
  if (impl === 'pith-vite') return join(compare, app, 'pith', 'dist');
  return join(compare, app, impl, 'dist');
}

function inside(base, rest) {
  const file = normalize(join(base, rest));
  return file === base || file.startsWith(base + sep) ? file : null;
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

const gzCache = new Map();

/**
 * @param {{ app: string, impl: string, h2?: boolean, port?: number, flows?: string | null, deploy?: boolean }} options
 *   flows: a different flows file to serve as /tests/flows.js
 *   deploy: impl pith loads pith.min.js (production, no dev warnings), as deployed without a build
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export async function startServer({ app, impl, h2 = false, port = 0, flows = null, deploy = false }) {
  if (!APPS.includes(app) || !IMPLS.includes(impl)) throw new Error(`unknown app/impl: ${app} ${impl}`);
  const root = appRoot(app, impl);
  const mounts = [
    ['/pith/', impl === 'pith-before' ? join(compare, '.pith-before') : join(framework, 'pith')],
    ['/__pith/', join(framework, 'tests')],
    ['/shared/', join(compare, 'shared')],
  ];
  const exact = {
    '/styles.css': join(compare, 'shared', 'styles.css'),
    '/tests/flows.js': flows ?? join(compare, 'flows', `${app}.js`),
  };

  async function resolve(pathname) {
    if (exact[pathname]) return exact[pathname];
    for (const [prefix, dir] of mounts) {
      if (pathname.startsWith(prefix)) {
        const file = inside(dir, pathname.slice(prefix.length));
        if (!file) return null;
        if (await isFile(file)) return file;
        return (await isFile(join(file, 'index.html'))) ? join(file, 'index.html') : null;
      }
    }
    const file = inside(root, pathname);
    if (!file) return null;
    if (await isFile(file)) return file;
    if (await isFile(join(file, 'index.html'))) return join(file, 'index.html');
    return extname(file) ? null : join(root, 'index.html'); // SPA fallback
  }

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      const file = await resolve(decodeURIComponent(url.pathname));
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const ext = extname(file);
      const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache' };
      let data = await readFile(file);
      const deployed = deploy && impl === 'pith' && ext === '.html';
      if (deployed) data = Buffer.from(forDeploy(data.toString('utf8')));
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        const key = `${file}:${(await stat(file)).mtimeMs}${deployed ? ':deploy' : ''}`;
        if (!gzCache.has(key)) gzCache.set(key, gzipSync(data, { level: 6 }));
        data = gzCache.get(key);
        headers['content-encoding'] = 'gzip';
      }
      headers['content-length'] = String(data.length);
      res.writeHead(200, headers);
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(err?.stack ?? err));
    }
  }

  const server = h2
    ? http2.createSecureServer({
        key: await readFile(join(compare, '.cert', 'key.pem')),
        cert: await readFile(join(compare, '.cert', 'cert.pem')),
        allowHTTP1: true,
      }, handle)
    : http.createServer(handle);
  await new Promise((r) => server.listen(port, r));
  const address = /** @type {import('node:net').AddressInfo} */ (server.address());
  return {
    url: `${h2 ? 'https' : 'http'}://localhost:${address.port}`,
    close: () => server.close(),
  };
}

if (import.meta.main) {
  const [app = 'trade', impl = 'pith'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const portArg = process.argv.indexOf('--port');
  const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 8000;
  const server = await startServer({ app, impl, h2: process.argv.includes('--h2'), port, deploy: process.argv.includes('--deploy') });
  console.log(`${app} / ${impl}: ${server.url}`);
}
