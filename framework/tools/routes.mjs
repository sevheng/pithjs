// Reads the route table in a project's app/router.js, without running it (shared by check.mjs and prerender.mjs).
//   '/todos': { title: 'Todos', load: () => import('./pages/todos.js') },
// Only route keys that start with '/' count, so the '*' not-found route is never listed.
// Also reads the project's optional prerender.mjs: the URLs of :param routes to prerender, e.g.
//   export default async function paths() { return team.map((p) => `/team/${p.id}`); }

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Every route in app/router.js, with the page file its lazy `load` imports (if any).
 * @param {string} root the project folder
 * title: the route's `title`, if written on its line · redirect: the route has a `redirect` option
 * @returns {{ path: string, file: string | null, title: string | null, redirect: boolean }[]}
 */
export function readRouteTable(root) {
  const routerFile = join(root, 'app', 'router.js');
  if (!existsSync(routerFile)) return [];
  const source = readFileSync(routerFile, 'utf8');
  return [...source.matchAll(/^\s*['"](\/[^'"]*)['"]\s*:(.*)$/gm)].map(([, path, rest]) => {
    const page = rest.match(/import\(\s*['"]([^'"]+)['"]\s*\)/)?.[1];
    const title = rest.match(/\btitle\s*:\s*(['"])(.*?)\1/)?.[2] ?? null;
    return { path, file: page ? resolve(root, 'app', page) : null, title, redirect: /\bredirect\s*:/.test(rest) };
  });
}

/**
 * The fixed routes (no `:params`) in app/router.js, e.g. ['/', '/todos', '/about'].
 * @param {string} root the project folder
 */
export const readRoutes = (root) => readRouteTable(root).map((r) => r.path).filter((p) => !p.includes(':'));

/** @param {string} pattern a route key like '/team/:id' → a regex, the same one framework/pith/router.js builds */
const patternRegex = (pattern) =>
  new RegExp(`^${pattern.replace(/\/+$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, '([^/]+)')}/?$`);

/**
 * The route a URL path shows (the first that matches, like the router), with its decoded params. null: none matches.
 * @template {{ path: string }} R
 * @param {R[]} routes from readRouteTable()
 * @param {string} url a path like '/team/3'
 * @returns {{ route: R, params: Record<string, string> } | null}
 */
export function matchRoute(routes, url) {
  for (const route of routes) {
    const m = patternRegex(route.path).exec(url);
    if (!m) continue;
    const keys = [...route.path.matchAll(/:(\w+)/g)].map((k) => k[1]);
    return { route, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

/**
 * Why a URL from prerender.mjs can't become a file, or null if it's fine.
 * @param {unknown} url
 */
function badUrl(url) {
  if (typeof url !== 'string') return 'is not a string';
  if (!url.startsWith('/') || url.startsWith('//')) return "doesn't start with a single '/'";
  if (/[?#]/.test(url)) return 'has a ?query or #hash (prerendered files are per path)';
  if (url.includes('\\')) return 'has a backslash';
  const parts = url.split('/').filter(Boolean);
  let decoded;
  try {
    decoded = parts.map(decodeURIComponent);
  } catch {
    return 'has a broken %-escape';
  }
  if (decoded.some((p) => p === '.' || p === '..')) return "has a '.' or '..' segment";
  if (decoded.some((p) => p.includes('/') || p.includes('\\'))) return 'has an escaped slash (%2F)';
  if (decoded.some((p) => p.includes(':'))) return "has a ':' (list real URLs like /team/3, not the route pattern)";
  return null;
}

/**
 * The URLs the project's prerender.mjs lists (its default export, a function returning an array), checked
 * and deduped, with a trailing slash removed. No prerender.mjs → no URLs. Bad URLs are left out (W065);
 * if prerender.mjs fails, there are none (W066).
 * @param {string} root the project folder
 * @returns {Promise<{ paths: string[], warnings: string[] }>}
 */
export async function loadPrerenderPaths(root) {
  const file = join(root, 'prerender.mjs');
  if (!existsSync(file)) return { paths: [], warnings: [] };
  let list;
  try {
    const mod = await import(`${pathToFileURL(file).href}?v=${statSync(file).mtimeMs}`); // re-import after edits
    if (typeof mod.default !== 'function') throw new Error('it needs `export default async function paths() { return [...] }`');
    list = await mod.default();
    if (!Array.isArray(list)) throw new Error(`its default export returned ${typeof list}, not an array of URLs`);
  } catch (err) {
    return { paths: [], warnings: [`[pith W066] prerender.mjs failed, so no :param pages were prerendered: ${err?.message ?? err}`] };
  }
  const paths = new Set();
  const warnings = [];
  for (const url of list) {
    const why = badUrl(url);
    if (why) warnings.push(`[pith W065] prerender.mjs listed ${JSON.stringify(url)}, which ${why}, so it wasn't prerendered.`);
    else paths.add(/** @type {string} */ (url).replace(/(.)\/+$/, '$1'));
  }
  return { paths: [...paths], warnings };
}

/**
 * Every URL to prerender: each fixed route, then each prerender.mjs URL (extra: true) with the route it
 * matches. A URL that matches no route is left out (W064).
 * @param {string} root the project folder
 */
export async function prerenderTargets(root) {
  const table = readRouteTable(root);
  const targets = table.filter((r) => !r.path.includes(':')).map((route) => ({ path: route.path, route, extra: false }));
  const { paths, warnings } = await loadPrerenderPaths(root);
  for (const path of paths) {
    if (targets.some((t) => t.path === path)) continue;
    const match = matchRoute(table, path);
    if (match) targets.push({ path, route: match.route, extra: true });
    else warnings.push(`[pith W064] ${path} matches no route in app/router.js, so it wasn't prerendered.`);
  }
  return { targets, warnings };
}
