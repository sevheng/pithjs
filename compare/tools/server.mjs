// Production-like server for comparisons: serves one app + framework, gzip-compressed, over
// HTTP/1.1 (http://) or HTTP/2 (https://, local self-signed cert), plus the shared CRM API.
//
//   node tools/server.mjs <app> <impl> [--h2] [--port 8000]
//   app:  todo | crm | bench          impl: mini | react | vue
//
// mini is served from source (no build step, as Mini is meant to run); react and vue are served
// from their Vite production builds (dist/), as they are meant to run. mini-vite is Mini's source
// bundled and minified by Vite (tools/build.mjs), to show what skipping the build costs.

import http from 'node:http';
import http2 from 'node:http2';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { handleApi } from '../shared/api.mjs';

const compare = join(import.meta.dirname, '..');
const framework = join(compare, '..', 'framework');
export const APPS = ['todo', 'crm', 'bench'];
export const IMPLS = ['mini', 'react', 'vue', 'mini-vite', 'mini-before'];

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
  if (impl === 'mini' || impl === 'mini-before') return join(compare, app, 'mini');
  if (impl === 'mini-vite') return join(compare, app, 'mini', 'dist');
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
 * @param {{ app: string, impl: string, h2?: boolean, port?: number, flows?: string | null }} options
 *   flows: a different flows file to serve as /tests/flows.js
 * @returns {Promise<{ url: string, close: () => void }>}
 */
export async function startServer({ app, impl, h2 = false, port = 0, flows = null }) {
  if (!APPS.includes(app) || !IMPLS.includes(impl)) throw new Error(`unknown app/impl: ${app} ${impl}`);
  const root = appRoot(app, impl);
  // mini-before: the same app on Mini's html.js from before the optimization pass (.mini-before/).
  const mounts = [
    ['/mini/', impl === 'mini-before' ? join(compare, '.mini-before') : join(framework, 'mini')],
    ['/__mini/', join(framework, 'tests')],
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
      if (url.pathname.startsWith('/api/')) {
        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const c of req) chunks.push(c);
          const text = Buffer.concat(chunks).toString('utf8');
          body = text ? JSON.parse(text) : null;
        }
        const { status, json } = await handleApi(req.method, url, body);
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(json === undefined ? undefined : JSON.stringify(json));
        return;
      }
      const file = await resolve(decodeURIComponent(url.pathname));
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }
      const ext = extname(file);
      const headers = { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-cache' };
      let data = await readFile(file);
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
        const key = `${file}:${(await stat(file)).mtimeMs}`;
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
  const [app = 'todo', impl = 'mini'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const portArg = process.argv.indexOf('--port');
  const port = portArg > 0 ? Number(process.argv[portArg + 1]) : 8000;
  const server = await startServer({ app, impl, h2: process.argv.includes('--h2'), port });
  console.log(`${app} / ${impl}: ${server.url}`);
}
