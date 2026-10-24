import { html } from 'pith';
import { code, api, note, c } from '../ui.js';

const warning = (id) => html`<a href=${`/docs/warnings#${id.toLowerCase()}`}>${id}</a>`;

const setup = `
// app/router.js
import { createRouter, html } from 'pith';

export const router = createRouter({
  '/': { title: 'Home', load: () => import('./pages/home.js') },
  '/todos': { title: 'Todos', load: () => import('./pages/todos.js') },
  '/user/:id': { title: 'User', load: () => import('./pages/user.js') },
  '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
}, { title: (t) => \`\${t} · My site\`, focus: '#main' });`;

const mainJs = `
// app/main.js
import { html } from 'pith';
import { router } from './router.js';

await router.ready; // the first page's code is here: a prerendered page never flashes empty
document.getElementById('app').replaceChildren(html\`
  <nav><a href="/">Home</a> <a href="/todos">Todos</a></nav>
  <main id="main" tabindex="-1">\${router.view}</main>
\`);`;

const pageFile = `
// app/pages/user.js
import { html } from 'pith';

export default function UserPage({ id }) {      // params arrive as the argument
  return html\`<h1>User \${id}</h1>\`;
}`;

const exportWrong = `
export function UserPage() { … }          // ✗ E005: a named export only
export default function UserPage() { … }  // ✓`;

const titles = `
'/docs/:page': { title: ({ page }) => \`Docs: \${page}\`, load: () => import('./pages/doc.js') },
'/inline': () => html\`<h1>Small page</h1>\`,  // an eager page: a view function, no lazy load`;

const layouts = `
const settings = { load: () => import('./layouts/settings.js') };

'/settings/profile': { title: 'Profile', layout: settings, load: () => import('./pages/profile.js') },
'/settings/billing': { title: 'Billing', layout: settings, load: () => import('./pages/billing.js') },

// app/layouts/settings.js
export default (page) => html\`
  <div class="settings">
    <nav><a href="/settings/profile">Profile</a> <a href="/settings/billing">Billing</a></nav>
    <section>\${page}</section>
  </div>\`;`;

const redirects = `
'/old-pricing': { redirect: '/pricing' },
'/u/:id': { redirect: ({ id }) => \`/user/\${id}\` },`;

const guard = `
import { session } from './store.js'; // createStore({ user: null }, { name: 'session' })

// Ask the server once, before the first guard runs (a top-level await holds the start).
session.user.value = await fetchJSON('/api/me').catch(() => null);

export const router = createRouter({
  '/login': { title: 'Sign in', load: () => import('./pages/login.js') },
  '/account': { title: 'Account', auth: true, load: () => import('./pages/account.js') },
  // …
}, {
  guard: (to) => (to.route.auth && !session.user.value ? \`/login?next=\${encodeURIComponent(to.path)}\` : true),
});`;

const query = `
import { router } from '../router.js';

// /team?q=ann&tag=a&tag=b
router.query.value.q;    // 'ann' (a repeated key keeps its last value)
router.queryAll('tag');  // ['a', 'b']

const q = () => router.query.value.q ?? '';
html\`<input type="search" aria-label="Search" .value=\${q}
  @input=\${(e) => router.setQuery({ q: e.target.value, page: null })}>\`;

router.setQuery({ tag: ['a', 'c'] });            // ?tag=a&tag=c
router.setQuery({ page: 2 }, { replace: false }); // a step the back button undoes`;

const nav = `
import { router } from '../router.js';

const save = async () => {
  await fetchJSON('/api/todos', { json: draft });
  router.navigate('/todos');                    // { replace: true } to replace the history entry
};
router.preload('/checkout');                     // download that page's code now`;

const links = `
<a href="/todos">Todos</a>                 <!-- handled by the router -->
<a href="/report.pdf" data-reload>PDF</a>  <!-- a normal full page load -->
<a href="https://example.com">Out</a>      <!-- other sites: left alone -->`;

export default () => html`
  <p>${c('createRouter(routes, options)')} maps URL paths to pages. Each page's code downloads only when
    it's first needed, links work without extra code, the page title follows the route, and the URL's
    ${c('?query')} is a signal you can read and write. Try the tabs above, then reload: the choice stays,
    because it lives in the URL.</p>

  <h2 id="setup">Setting it up</h2>
  <p>The route table lives in ${c('app/router.js')}: one line per page. Put ${c('router.view')} where pages
    should appear.</p>
  ${code(setup, { file: 'app/router.js' })}
  ${code(mainJs, { file: 'app/main.js' })}
  <p>${c('title')} formats ${c('document.title')}. ${c('focus')} is the element focused after each page change,
    so screen reader and keyboard users start at the new content. ${c('npm run new page contact')} adds the
    page file and its route for you.</p>
  ${note(html`Route patterns start with ${c('/')} (${warning('W011')}), and each route needs a ${c('load')}
    or a view (${warning('W012')}). Add a ${c("'*'")} route for unknown URLs; without one they show plain
    "Not found" text (${warning('W013')}).`, 'warn')}

  <h2 id="lazy">Lazy pages</h2>
  <p>A ${c('load')} route imports the page file on its first visit and calls its <strong>default
    export</strong>. Until it arrives, the current page stays on screen, so there's no blank flash. A slow
    page can't overwrite a newer click, and a failed download is tried once more before it shows "This page didn't load" with "Try again".</p>
  ${code(pageFile, { file: 'app/pages/user.js' })}
  ${note(html`The page file must ${c('export default')} its function, or it fails with ${warning('E005')}.`, 'warn')}
  ${code(exportWrong)}
  <h3>Prefetch on hover</h3>
  <p>Pointing at, focusing or touching a link to a page starts downloading its code, so by the click it's
    usually there. Turn it off with ${c('prefetch: false')}. To fetch a page you know comes next, call
    ${c("router.preload('/checkout')")}. ${c('loading: () => html`…`')} is shown on a first visit only if
    there's nothing on screen yet.</p>

  <h2 id="params">Params and titles</h2>
  <p>${c(':name')} in a pattern matches one path segment; the page gets it in its argument
    (${c('{ id }')} above), decoded. ${c('router.params')} has the same values as a signal. A ${c('title')}
    can be a string or a function of the params:</p>
  ${code(titles)}

  <h2 id="layouts">Layouts</h2>
  <p>${c('layout')} wraps a page, for a side nav or tabs shared by several pages. Pages with the same layout
    keep it mounted while you move between them, so what it holds (an open menu, a scrolled side nav,
    text in a search box) survives. A layout is a function ${c('(page) => html`…${page}…`')}, or
    ${c('{ load }')} to download it with the page (default export, ${warning('E005')}).</p>
  ${code(layouts)}

  <h2 id="redirects">Redirects and guards</h2>
  <p>${c('redirect')} sends a route elsewhere: a path, or a function of the params. Redirects replace the
    history entry, so Back doesn't bounce.</p>
  ${code(redirects)}
  <p>${c('guard(to)')} runs before every page change (the first load, links, ${c('navigate()')},
    back and forward) with ${c('{ path, params, query, route }')}. ${c('route')} includes your own fields,
    like ${c('auth')}. Return ${c('true')} to allow the page or a path to go there instead. Guards are
    synchronous, so if the server decides who's signed in, ask it once at the top of ${c('app/router.js')}:</p>
  ${code(guard, { file: 'app/router.js' })}
  ${note(html`Return ${c('true')} or a path. ${c('false')} or nothing doesn't block the page
    (${warning('W022')}). Don't guard the page you redirect to, or the two bounce until Pith stops them
    (${warning('W020')}).`, 'warn')}
  ${note(html`A guard only picks which page to show. It isn't security: the API must refuse requests the user
    may not make. Per-item access (may this user open ${c('/projects/42')}?) goes in the page, as a
    "No access" view for a 403.`, 'warn')}

  <h2 id="query">The query string</h2>
  <p>${c('router.query')} is the URL's ${c('?search')} as an object, in a signal: read it in a hole and the
    hole updates. ${c('router.setQuery(values)')} merges values into the URL without re-rendering the page
    (${c('null')}, ${c("''")} or ${c('[]')} removes a key; an array writes the key once per value). Keep
    filters, search text, tabs and page numbers there, so a reload or a shared link keeps them.</p>
  ${code(query)}
  <p>${c('setQuery')} replaces the history entry, so typing in a search box doesn't fill up the back button.
    Pass ${c('{ replace: false }')} for a change that should be a step.</p>

  <h2 id="navigate">Links and navigating in code</h2>
  <p>Same-site ${c('<a href>')} clicks are handled for you (not with a modifier key, a ${c('target')} or
    ${c('download')}). Page changes animate with View Transitions where the browser has them, except with
    reduced motion and on back and forward.</p>
  ${code(links)}
  <p>In code, call ${c('router.navigate(path)')}, for example after a save. The same page with only a new
    ${c('?query')} just updates ${c('router.query')}; the page doesn't re-render.</p>
  ${code(nav)}
  <h3>Scroll</h3>
  <p>A link scrolls to the top, or to the element named by its ${c('#hash')}. Back and forward put the scroll
    position back where it was.</p>

  <h2 id="errors">Not found and errors</h2>
  <p>The ${c("'*'")} route is the page for unknown URLs. A page that throws, or whose code didn't load, shows
    the router's error view with "Try again"; the rest of the app keeps working. Replace that view with the
    ${c('error')} option. See <a href="/docs/errors">Error boundaries</a>.</p>

  <h2 id="api">API</h2>
  ${api([
    ['createRouter(routes, options?)', 'Creates the router. Patterns: /, /todos, /user/:id, and * for not found.'],
    ['{ load, title, layout }', html`A lazy route. ${c('title')}: a string or ${c('(params) => string')}. Custom fields go to the guard.`],
    ['(params) => view', 'An eager route: a view function.'],
    ['{ redirect }', html`A path, or ${c('(params) => path')}.`],
    ['options.title', html`${c('(t) => string')}: formats ${c('document.title')}.`],
    ['options.focus', 'A selector focused after each page change.'],
    ['options.guard', html`${c('(to) => true | path')}, before every page change. Synchronous.`],
    ['options.error', html`${c('(err, retry) => view')} for a page that failed or crashed.`],
    ['options.loading', html`${c('() => view')} while a page's code downloads on first visit.`],
    ['options.prefetch · transitions', html`${c('false')} turns off prefetch on hover, or View Transitions.`],
    ['router.view', html`Put it in a template: ${c('${router.view}')}.`],
    ['router.path · router.params', 'Signals: the current path and its :params.'],
    ['router.query', 'Signal: the ?query as an object.'],
    ['router.queryAll(key)', 'Every value of a repeated key. Reactive.'],
    ['router.setQuery(values, { replace })', 'Merges into the ?query without re-rendering. Replaces the history entry by default.'],
    ['router.navigate(path, { replace })', 'Goes to a path in code.'],
    ['router.preload(path)', 'Downloads that page’s code now.'],
    ['router.ready', 'A promise: the first page’s code (and layout) has loaded or failed.'],
  ])}
`;
