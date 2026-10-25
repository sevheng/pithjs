import { html } from 'pith';
import { code, note, c } from '../ui.js';

const build = `
npm run build                    # → dist/, every route prerendered
npm run build -- --no-prerender  # the same, without prerendering
npm run preview                  # serve dist/ locally
npm run check -- --build         # build, then run every check against dist/`;

const prerender = `
import { team } from './api/team.mjs';   // export the data from the api file

// Runs in Node during the build. Returns the real URLs of :param routes.
export default async () => team.map((p) => \`/team/\${p.id}\`);
// → dist/team/1/index.html, dist/team/2/index.html, ...`;

const mainJs = `
import { html } from 'pith';
import { router } from './router.js';

// Wait for the first page's code, so the prerendered HTML is swapped
// for the live page without a blank flash.
await router.ready;
document.getElementById('app').replaceChildren(html\`...\${router.view}...\`);`;

const noBuild = `
<script type="importmap">{ "imports": { "pith": "/pith/pith.min.js" } }</script>
<link rel="modulepreload" href="/pith/pith.min.js">   <!-- instead of /pith/index.js, /pith/signal.js, ... -->`;

const nginx = `
try_files $uri $uri/index.html /404.html;`;

export default () => html`
  <p>
    A Pith app runs in the browser exactly as written, so there are two ways to ship it: a Vite build that
    bundles and prerenders (the default, and the fastest to load), or the project folder as it is, with
    nothing installed on the way.
  </p>

  <h2 id="build">npm run build</h2>
  <p>
    ${c('npm run build')} makes ${c('dist/')} with Vite and the same Pith plugin ${c('npm run dev')} uses:
  </p>
  <ul>
    <li>each page is bundled with its imports, so there's no import waterfall;</li>
    <li>code the app doesn't use is removed (a one-page app doesn't ship the router);</li>
    <li>everything is minified, and file names are fingerprinted so browsers can cache them forever;</li>
    <li>dev warnings are stripped, so their code costs nothing in production;</li>
    <li>every fixed route is <strong>prerendered</strong> to ${c('dist/<route>/index.html')} in headless Chrome.</li>
  </ul>
  ${code(build)}
  <p>
    A prerendered page shows its content before any JavaScript runs, and search engines see it. When the app
    starts, it replaces that HTML with the live page. For that swap to be seamless, ${c('app/main.js')} waits
    for the first page's code before it renders:
  </p>
  ${code(mainJs, { file: 'app/main.js' })}
  <p>
    Clicks made before the app starts aren't lost: a small inline script (only in prerendered HTML) holds
    clicks on buttons, checkboxes and ${c('<summary>')}, and form submits, then replays them on the live app,
    with typed text and focus. Links work without JavaScript, so they're left alone.
  </p>
  ${note(html`Prerendering is skipped if Chrome isn't found. Routes that redirect (a ${c('redirect')}, or the
    guard sending a signed-out visitor away) are left out on purpose (W063), so give every route a ${c('title')}.`)}

  <h2 id="param-routes">Prerendering :param routes</h2>
  <p>
    The build can't guess which ${c('/team/:id')} pages exist, so list them in an optional
    ${c('prerender.mjs')} next to ${c('index.html')}. It runs in Node at build time, like ${c('api/*.mjs')}, and
    its default export returns the URLs:
  </p>
  ${code(prerender, { file: 'prerender.mjs' })}
  <p>
    Each URL must match a route (${c('/team/3')} matches ${c("'/team/:id'")}) and be a plain path: no
    ${c('?query')}, ${c('#hash')}, ${c('..')} or ${c(':')}. A trailing slash is dropped and duplicates are
    ignored. Unlisted URLs get ${c('dist/404.html')}, the plain app shell, and still work once the app starts.
    Build warnings W060 to W066 name the routes and URLs that couldn't be prerendered, and why.
  </p>

  <h2 id="data-handover">Data in prerendered pages</h2>
  <p>
    A page that loads data from ${c('/api')} is prerendered with what your dev ${c('api/')} returned during the
    build. Both the HTML and the JSON answers of the page's requests are baked in (a ${c('#pith-data')}
    script). When the app starts, the first ${c('fetchJSON')} of each of those URLs uses its baked answer
    instead of a request, so the data on screen isn't swapped for "Loading…" while the request runs.
  </p>
  <p>
    Each answer is used once; a refetch, a search or "Load more" always asks the server. The baked data is
    from build time, so rebuild to refresh it.
  </p>

  <h2 id="check-the-build">Check the build</h2>
  <p>
    ${c('npm run preview')} serves ${c('dist/')} locally; unknown paths get ${c('dist/404.html')}, like a real
    host. ${c('npm run check -- --build')} builds the app, then runs every check against the built files, and
    fails if a route, or a URL from ${c('prerender.mjs')}, wasn't prerendered.
  </p>

  <h2 id="hosting">Hosting</h2>
  <p>
    Put ${c('dist/')} on any static host, and turn on the "SPA fallback" for unknown paths, pointing at
    ${c('/404.html')}. Netlify, GitHub Pages and Cloudflare Pages use ${c('404.html')} by themselves. On nginx:
  </p>
  ${code(nginx, { label: 'nginx SPA fallback' })}
  ${note(html`Static hosting doesn't run ${c('api/')}. Those files are a fake backend for development (and for
    the build's baked data). In production a real backend must answer the same URLs.`, 'warn')}

  <h2 id="without-a-build">Deploying without a build</h2>
  <p>
    You can also deploy the project folder as it is. Copy ${c('pith.min.js')} (in ${c('node_modules/pithjs/pith/')})
    to ${c('/pith/pith.min.js')} on the host, then make two changes in the deployed ${c('index.html')}: the import
    map points at it, and it's Pith's only preload.
  </p>
  ${code(noBuild, { file: 'index.html' })}
  <p>
    ${c('pith.min.js')} is the whole framework in one minified file, without the dev-only code: about 10 KB
    gzipped in one request, instead of about 30 KB in ten files. It's built once and committed, so deploying
    needs nothing installed. ${c('forDeploy(html)')} in ${c('tools/release.mjs')} makes those two edits for you.
  </p>
  <p>
    Which to pick? Measured on a slow phone (in the repo's ${c('compare/')} folder), a site deployed this way
    is ready about as soon as the same app in Vue (from 5% later to 11% sooner) and 19–31% sooner than in React,
    but 12–32% behind ${c('npm run build')}, which bundles your own files into one and prerenders. Keep ${c('/pith/index.js')} in development either way, so the warnings stay on.
  </p>
`;
