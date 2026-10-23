// Pre-rendering (run by npm run build after Vite): turns each fixed route, and each URL listed by the
// project's optional prerender.mjs (for :param routes, e.g. /team/3), into a real HTML file.
//   dist/index.html, dist/todos/index.html, ... hold the page's markup inside
//   <div id="app"><div data-prerendered>, so the page shows (and search engines see it) before any JS runs.
//   The app's JS then replaces that markup with the live app (main.js calls #app.replaceChildren).
// How: serve dist/ (with the dev api/), load each route in headless Chrome with a fresh profile
// (no saved theme, no saved data), and copy #app's HTML and document.title into the built index.html.
//   dist/404.html is the untouched app shell: point your host's SPA fallback ("unknown paths → ...")
//   at it, so unknown URLs and unlisted :param URLs don't first flash the home page. dist/index.html still
//   works as a fallback too, it just shows the home page's markup until the JS has loaded.
// A :param route is prerendered only for the URLs prerender.mjs lists (see routes.mjs, loadPrerenderPaths):
//   export default async function paths() { return team.map((p) => `/team/${p.id}`); }
// The '*' not-found route isn't prerendered.
// Each page also carries the JSON answers of the GETs it fetched while prerendering (#mini-data), so the
// live app's first fetchJSON of those URLs uses them instead of showing "Loading…" over data already on
// screen (see fetchJSON in mini/resource.js). They're the answers from build time, used once at startup.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { findChrome, loadPage, unescapeHtml } from './chrome.mjs';
import { projectRoot, startServer } from './dev-server.mjs';
import { prerenderTargets } from './routes.mjs';
import { replayScript } from './replay.mjs';

const NOT_FOUND = '/__prerender-unknown-page__';
const PROBLEM = /\[mini |Uncaught|Error|Failed to load/;

/** @param {string} s */
export const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * The file (relative to dist/) a route is written to: '/' → index.html, '/todos' → todos/index.html,
 * '/team/3' → team/3/index.html.
 * @param {string} route
 */
export function routeFile(route) {
  const parts = decodeURIComponent(route).split('/').filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..' || p.includes(':') || p.includes('\\'))) {
    throw new Error(`Can't prerender route "${route}": only fixed paths like /about can become files.`);
  }
  return join(...parts, 'index.html');
}

/**
 * Pull #app's inner HTML and the title out of a DOM dumped by Chrome. null if there's no #app.
 * @param {string} dom
 * @returns {{ html: string, title: string } | null}
 */
export function extractPage(dom) {
  const open = /<div\b[^>]*\bid="app"[^>]*>/.exec(dom);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tags = /<div\b|<\/div>/g;
  tags.lastIndex = start;
  let depth = 1;
  for (let m; (m = tags.exec(dom)); ) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) {
      return { html: dom.slice(start, m.index).trim(), title: unescapeHtml(dom.match(/<title>([^<]*)<\/title>/)?.[1] ?? '') };
    }
  }
  return null;
}

// JSON that's safe inside a <script> element (no "</script>" or "<!--" can appear).
const scriptJson = (data) => JSON.stringify(data).replace(/</g, '\\u003c');

const RECORDED = 'mini-prerender-data';

/**
 * The shell served while prerendering: a script first in <head> records the JSON answer of each successful
 * GET the page fetches, keyed by the URL as the app passed it (as fetchJSON sees it), into #mini-prerender-data.
 * @param {string} shell the built index.html
 */
export function recordData(shell) {
  const recorder = `(() => {
  const real = fetch, data = {}, out = document.createElement('script');
  out.type = 'application/json'; out.id = '${RECORDED}'; document.head.append(out);
  window.fetch = async (url, init) => {
    const res = await real(url, init);
    if (typeof url === 'string' && (init?.method ?? 'GET') === 'GET' && res.ok) {
      res.clone().json().then((v) => { data[url] = v; out.textContent = JSON.stringify(data).replace(/</g, '\\\\u003c'); }, () => {});
    }
    return res;
  };
})()`;
  return shell.replace(/<head[^>]*>/, (head) => `${head}\n<script>${recorder}</script>`);
}

/**
 * The answers recordData()'s script recorded, from a DOM dumped by Chrome ({} if none).
 * @param {string} dom
 * @returns {Record<string, unknown>}
 */
export function extractData(dom) {
  const json = dom.match(new RegExp(`<script type="application/json" id="${RECORDED}">([\\s\\S]*?)</script>`))?.[1];
  return json ? JSON.parse(json) : {};
}

/**
 * The built index.html with a page's markup in #app (in a data-prerendered wrapper) and its title.
 * @param {string} shell the built index.html
 * @param {{ html: string, title: string, preload?: string[], script?: string, data?: Record<string, unknown> }} page
 *   preload: JS files to fetch early · script: inline JS run right after #app, before the app's (deferred)
 *   module (default: replayScript(), which keeps clicks made before the app starts) · data: the GET answers
 *   the page was built with, for fetchJSON at startup (#mini-data)
 */
export function injectPage(shell, { html, title, preload = [], script = replayScript(), data = {} }) {
  const app = /<div\b([^>]*\bid="app"[^>]*)>[\s\S]*?<\/div>(\s*<\/body>)/;
  if (!app.test(shell)) throw new Error('The built index.html has no <div id="app"></div> right before </body>.');
  const links = preload.map((href) => `  <link rel="modulepreload" crossorigin href="${escapeHtml(href)}">\n`).join('');
  const inline = (Object.keys(data).length ? `<script type="application/json" id="mini-data">${scriptJson(data)}</script>` : '')
    + (script ? `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>` : '');
  return shell
    .replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`)
    .replace(/(\n?)<\/head>/, (_, nl) => `${nl}${links}</head>`)
    // A wrapper, not #app itself, carries the mark: the app's first render replaces it, and components
    // inside it don't start until then (they'd have no props or context yet).
    .replace(app, (_, attrs, end) => `<div${attrs}><div data-prerendered style="display:contents">${html}</div></div>${inline}${end}`);
}

/**
 * True when a route showed another page than its own (its `redirect`, or the guard sent it away), so its
 * file must not be written: a visitor allowed in would see the other page first.
 * @param {{ title: string | null, redirect: boolean }} route
 * @param {string} renderedTitle document.title after the page rendered
 */
export const landedElsewhere = (route, renderedTitle) =>
  route.redirect || (route.title != null && !renderedTitle.includes(route.title));

/**
 * Prerender every fixed route of the project's built dist/, and every URL its prerender.mjs lists.
 * Needs Chrome (returns { skipped } without it).
 * @param {{ root?: string, chunks?: { fileName: string, facadeModuleId?: string | null, imports?: string[] }[] }} [options]
 *   chunks: Vite's output chunks, used to preload each page's code so its markup isn't blanked while it loads
 *   redirected: routes not written because they showed another page (W063); that's expected, not a failure
 *   pages[].route: the URL prerendered ('/team/3' for the route '/team/:id')
 * @returns {Promise<{ skipped?: string, pages: { route: string, file: string }[], redirected?: string[], warnings: string[] }>}
 */
export async function prerender({ root = projectRoot, chunks = [] } = {}) {
  if (resolve(root) !== resolve(projectRoot)) {
    throw new Error(`prerender serves ${projectRoot}/dist; run it from ${root} (or set MINI_PROJECT=${root}).`);
  }
  const chrome = findChrome();
  if (!chrome) return { skipped: 'Chrome not found (set CHROME_PATH to prerender pages)', pages: [], warnings: [] };

  const dist = join(root, 'dist');
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  const { targets, warnings } = await prerenderTargets(root);
  if (!targets.length) return { skipped: 'no fixed routes in app/router.js (or URLs in prerender.mjs)', pages: [], warnings };

  // Pages load from a shell that records their GET answers; the plain one is put back after.
  writeFileSync(join(dist, 'index.html'), recordData(shell));
  const server = await startServer(0, { dist: true });
  const base = `http://localhost:${server.address().port}`;
  let loaded;
  try {
    loaded = await Promise.all([...targets.map((t) => t.path), NOT_FOUND].map((path) => loadPage(chrome, base + path)));
  } finally {
    server.close();
    writeFileSync(join(dist, 'index.html'), shell);
  }

  // The untouched shell, for the host's SPA fallback (unknown URLs, :param URLs prerender.mjs didn't list).
  writeFileSync(join(dist, '404.html'), shell);

  const notFoundTitle = extractPage(loaded.at(-1).dom)?.title;
  const pages = [];
  const redirected = [];
  targets.forEach(({ path, route, extra }, i) => {
    const pageFile = route.file;
    const { dom, consoleLines } = loaded[i];
    const page = extractPage(dom);
    const problems = consoleLines.filter((l) => PROBLEM.test(l));
    if (problems.length) return warnings.push(`[mini W062] ${path} logged errors while prerendering, so it wasn't written:\n  ${problems.join('\n  ')}`);
    if (!page?.html) return warnings.push(`[mini W061] ${path} rendered nothing into #app, so it wasn't prerendered.`);
    if (page.title === notFoundTitle) {
      return warnings.push(extra
        ? `[mini W064] ${path} (from prerender.mjs) showed the not-found page ("${page.title}"), so it wasn't prerendered.`
        : `[mini W060] ${path} showed the not-found page ("${page.title}"), so it wasn't prerendered.`);
    }
    if (landedElsewhere(route, page.title)) return redirected.push(path), warnings.push(`[mini W063] ${path} redirected to another page ("${page.title}"), so it wasn't prerendered.`);
    const chunk = chunks.find((c) => c.facadeModuleId && pageFile && resolve(c.facadeModuleId) === pageFile);
    const preload = chunk ? [chunk.fileName, ...(chunk.imports ?? [])].map((f) => `/${f}`).filter((f) => !shell.includes(f)) : [];
    const file = routeFile(path);
    const target = join(dist, file);
    if (!target.startsWith(dist + sep)) throw new Error(`Can't prerender route "${path}" outside dist/.`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, injectPage(shell, { ...page, preload, data: extractData(dom) }));
    pages.push({ route: path, file: join('dist', file) });
  });
  return { pages, redirected, warnings };
}
