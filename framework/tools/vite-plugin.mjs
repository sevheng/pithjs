// The Pith plugin for Vite, used by both `npm run dev` (tools/dev.mjs) and `npm run build` (tools/build.mjs).
//   - resolves `import ... from 'pith'` to the framework (and 'pith/testing' to the test harness)
//   - drops index.html's import map and module preloads, which only the no-build server needs
//   - dev only: serves the project's api/*.mjs (same handler as the no-build server), and the
//     framework's test pages at /__pith/ plus the raw files they load (/pith/, /tests/)

import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { handleApi, types } from './dev-server.mjs';

const framework = join(import.meta.dirname, '..');

export const stripNoBuildTags = (html) =>
  html
    .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
    .replace(/\s*<link rel="modulepreload"[^>]*>/g, '');

/**
 * @param {{ projectRoot: string }} options
 * @returns {import('vite').Plugin}
 */
export function pith({ projectRoot }) {
  // Served as-is, not through Vite: test pages load Pith through their own import map, and must
  // share one copy of the harness with the flows file they import.
  const raw = [
    ['/__pith/', join(framework, 'tests')],
    ['/pith/', join(framework, 'pith')],
    ['/tests/', join(projectRoot, 'tests')],
  ];

  async function serveRaw(pathname, res) {
    const mount = raw.find(([prefix]) => pathname.startsWith(prefix));
    if (!mount) return false;
    const [prefix, dir] = mount;
    let file = normalize(join(dir, pathname.slice(prefix.length)));
    if (file !== dir && !file.startsWith(dir + sep)) return false;
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
      return true;
    } catch {
      return false;
    }
  }

  return {
    name: 'pith',
    config: () => ({
      resolve: {
        alias: [
          { find: /^pith$/, replacement: join(framework, 'pith', 'index.js') },
          { find: /^pith\/testing$/, replacement: join(framework, 'tests', 'harness.js') },
        ],
      },
      server: { fs: { allow: [projectRoot, framework] } },
    }),
    transformIndexHtml: { order: 'pre', handler: stripNoBuildTags },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handleApi(req, res, url);
        if (await serveRaw(decodeURIComponent(url.pathname), res)) return;
        next();
      });
    },
  };
}
