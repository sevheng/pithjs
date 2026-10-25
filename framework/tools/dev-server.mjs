// Tiny static server for development, run from a project folder (npm run dev).
//   /pith/*     → the framework (framework/pith)
//   /__pith/*   → framework test pages and the test harness (framework/tests)
//   everything else → the project folder; unknown paths without a file extension get index.html,
//   so reloading on a route like /todos still works.
// With --dist (npm run preview), "the project folder" is its dist/ build instead; tests/ and api/
// still come from the project, so checks and the dev API work against the built app.
// Dev-only API: /api/<name> runs the GET/POST/PUT/PATCH/DELETE function exported by api/<name>.mjs.
// A handler gets { query, body, params } and returns JSON data, or a Response for another status:
//   return Response.json({ errors: { email: 'Taken' } }, { status: 422 });
// Static hosting does not run api/ files: production needs a real backend.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const frameworkRoot = join(import.meta.dirname, '..');
// The project being served: the folder npm runs scripts in, or PITH_PROJECT.
export const projectRoot = process.env.PITH_PROJECT ?? process.cwd();
let siteRoot = projectRoot;
let mounts = [
  ['/pith/', join(frameworkRoot, 'pith')],
  ['/__pith/', join(frameworkRoot, 'tests')],
];
const port = Number(process.env.PORT) || 8000;
let sitePath = '/'; // the base the site is served under (pith build --base): stripped from each request

/** '/pithjs', 'pithjs/' or '/pithjs/' → '/pithjs/'; nothing → '/'. */
export const normalizeBase = (value) => (value ? `/${value.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/') : '/');
/** The --base value in a command line, normalized ('/' without one). */
export const baseArg = (args) => normalizeBase(args.includes('--base') ? args[args.indexOf('--base') + 1] : undefined);
export const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function resolveFile(pathname) {
  const mount = mounts.find(([prefix]) => pathname.startsWith(prefix));
  const base = mount ? mount[1] : siteRoot;
  const file = normalize(join(base, mount ? pathname.slice(mount[0].length) : pathname));
  if (file !== base && !file.startsWith(base + sep)) return null; // block ../ escapes
  try {
    const info = await stat(file);
    if (!info.isDirectory()) return file;
    const index = join(file, 'index.html');
    if (existsSync(index) || mount) return index;
    throw new Error('a folder without index.html: an app route'); // e.g. dist/settings/ holding only sub-pages
  } catch {
    if (extname(file) || mount) return null;
    // A prerendered build keeps the plain app shell in 404.html (index.html is the home page).
    const shell = join(siteRoot, '404.html');
    return existsSync(shell) ? shell : join(siteRoot, 'index.html');
  }
}

export const sendJson = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('Body too large'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Body is not valid JSON'), { status: 400 });
  }
}

/** /__pith/project: which project a dev server serves, so `see` can use the one already running. */
export const handleProject = (res, dist = false) => sendJson(res, 200, { root: projectRoot, dist });

export async function handleApi(req, res, url) {
  const name = url.pathname.slice('/api/'.length).replace(/\/+$/, '');
  if (!/^[\w-]+$/.test(name)) return sendJson(res, 404, { message: `No API at ${url.pathname}` });
  const file = join(projectRoot, 'api', `${name}.mjs`);
  let mod;
  try {
    const { mtimeMs } = await stat(file);
    mod = await import(`${pathToFileURL(file).href}?v=${mtimeMs}`); // re-import after edits
  } catch (err) {
    if (err.code === 'ENOENT') return sendJson(res, 404, { message: `No API at ${url.pathname}: create api/${name}.mjs` });
    console.error(`api/${name}.mjs failed to load:`, err);
    return sendJson(res, 500, { message: `api/${name}.mjs failed to load: ${err.message}` });
  }
  const handler = mod[req.method];
  if (typeof handler !== 'function') return sendJson(res, 405, { message: `api/${name}.mjs has no ${req.method} export` });
  try {
    const body = await readBody(req);
    const result = await handler({ query: Object.fromEntries(url.searchParams), body, method: req.method });
    if (result instanceof Response) {
      res.writeHead(result.status, Object.fromEntries(result.headers));
      res.end(Buffer.from(await result.arrayBuffer()));
    } else {
      sendJson(res, 200, result ?? null);
    }
  } catch (err) {
    if (!err.status) console.error(`api/${name}.mjs ${req.method} threw:`, err);
    sendJson(res, err.status ?? 500, { message: err.message });
  }
}

async function handle(req, res) {
  let url, pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    if (sitePath !== '/' && url.pathname.startsWith(sitePath)) url.pathname = url.pathname.slice(sitePath.length - 1);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(req, res, url);
  if (pathname === '/__pith/project') return handleProject(res, siteRoot !== projectRoot);
  const file = await resolveFile(pathname);
  try {
    if (!file) throw new Error('not found');
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}

/**
 * Port 0 picks any free port; read it back from server.address().port.
 * @param {number} [listenPort]
 * @param {{ dist?: boolean, base?: string }} [options] dist: serve the project's dist/ build (see npm run build) ·
 *   base: the site's base path (pith build --base), served at /base/ like its host will
 */
export function startServer(listenPort = port, { dist = false, base = '/' } = {}) {
  sitePath = base;
  if (dist) {
    siteRoot = join(projectRoot, 'dist');
    mounts = [...mounts, ['/tests/', join(projectRoot, 'tests')]];
  }
  return new Promise((resolve, reject) => {
    const server = createServer(handle);
    server.once('error', reject);
    server.listen(listenPort, () => resolve(server));
  });
}

if (import.meta.main) {
  const dist = process.argv.includes('--dist');
  const base = baseArg(process.argv);
  const server = await startServer(port, { dist, base });
  console.log(`Pith ${dist ? 'preview' : 'dev'} server: http://localhost:${server.address().port}${base}  (serving ${dist ? join(projectRoot, 'dist') : projectRoot})`);
}
