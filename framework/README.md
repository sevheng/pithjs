# Mini

A tiny web framework built on native browser tech: **no dependencies, no build step.**
Signals, `html` templates, Web Components, a lazy-loading router, a store, data loading and forms.

**Size budget: 10 KB.** The whole framework (`'mini'`, every export), built and gzipped, must stay within
10 KB (10,000 bytes); it's 9.7 KB now. `npm run check` measures it every run (`tools/size.mjs`) and fails
over budget, so a new feature has to pay for itself. Apps usually ship less, since the build drops what
they don't use. Only what most apps need, and is easy to get wrong, belongs in it; the rest (UI widgets,
animation helpers beyond `transition()`) is app code an AI agent can write from the browser's own APIs.

## This folder

```
mini/        the framework (import it as 'mini'); mini.min.js is its one-file production copy (tools/release.mjs)
tools/       dev (Vite), build (Vite), the no-build server, check, see, new: run them from a project folder
tests/       framework tests, the test harness ('mini/testing'), and the pages check/see use
docs/        errors.md: every warning and error code with its fix
```

Working on the framework itself: `npm test` (Node) and `npm run check` (adds browser tests and types).
For changes that affect apps, also run `npm run check` in `../demo`.

## Using Mini in a project

A project sits next to this folder (see `../demo`) and calls the tools from its `package.json`:

```json
"scripts": {
  "dev": "node ../framework/tools/dev.mjs",
  "dev:no-build": "node ../framework/tools/dev-server.mjs",
  "build": "node ../framework/tools/build.mjs",
  "preview": "node ../framework/tools/dev-server.mjs --dist",
  "check": "node ../framework/tools/check.mjs",
  "see": "node ../framework/tools/see.mjs",
  "new": "node ../framework/tools/new.mjs"
}
```

`npm run dev` is Vite with the Mini plugin (`tools/vite-plugin.mjs`). It reloads on save, updates CSS in place,
and shows errors as an overlay, and it serves `api/` and the test pages at `/__mini/`. It needs `npm install --save-dev vite`.
`npm run dev:no-build` is the zero-install server: the project folder as-is, the framework at `/mini/`.
`check` and `see` always use the no-build server, so their results don't depend on Vite.
The project's `index.html` maps the imports:
`<script type="importmap">{ "imports": { "mini": "/mini/index.js" } }</script>`.

```sh
npm run dev                        # → http://localhost:8000  (PORT=3000 npm run dev for another port)
npm run check                      # everything: tests, user flows, every route, phone layout, accessibility, types
npm run see /todos [--mobile]      # the page as a text outline + a screenshot
npm run new page contact -- --nav  # new page, wired into the router and nav
npm run new component user-card    # new component
```

Needs Node 24+ and Chrome/Chromium (set `CHROME_PATH` if it isn't found). Checks run a few headless
Chromes at a time (a quarter of your CPU cores); `MINI_CHROME_JOBS=2` lowers that on a busy machine.

### Production builds

`npm run build` makes `dist/`, using the same Mini plugin as `npm run dev`:
- each page is bundled with its imports, so there is no import waterfall;
- unused code is removed (a one-page app doesn't ship the router);
- everything is minified and fingerprinted;
- dev warnings are stripped;
- every fixed route is **prerendered** to `dist/<route>/index.html` (in headless Chrome), so its content
  shows before any JS runs and search engines see it. The app's JS then replaces it with the live page.
  Skip it with `npm run build -- --no-prerender`; it's skipped automatically if Chrome isn't found.

`main.js` should `await router.ready` (the first page's code has loaded) before replacing `#app`,
so the prerendered page never flashes empty:

```js
await router.ready;
document.getElementById('app').replaceChildren(html`...${router.view}...`);
```

Routes with `:params` are prerendered for the URLs your project lists in an optional `prerender.mjs`
(next to `index.html`). It runs in Node during the build, like `api/*.mjs`, and its default export
returns the URLs:

```js
// prerender.mjs
import { team } from './api/team.mjs';
export default async () => team.map((p) => `/team/${p.id}`);
```

Each URL must match a route (`/team/3` matches `'/team/:id'`) and is written to `dist/team/3/index.html`,
with that route's page code preloaded. URLs are plain paths: no `?query`, `#hash`, `..` or `:`; a trailing
slash is dropped and duplicates are ignored. Unlisted URLs get `dist/404.html`, the plain shell.
`npm run check` also renders the first listed URL of each `:param` route; `--build` checks every listed
URL was prerendered.

**Clicks before the app starts aren't lost.** Until the app replaces it the prerendered page is static: its
components don't start (they'd have no props or context yet). A small inline script (~0.7 KB gzipped, only
in prerendered HTML, not in `'mini'`) keeps what the user does in that moment: clicks on buttons,
checkboxes, radios and `<summary>`, and form submits, are held (no page reload) and replayed on the live
app once it starts, along with typed text and focus. A held click replays only if the live element at the
same place looks the same (tag and text or `aria-label`), so a page that renders differently drops it
instead of clicking the wrong thing. Links are left alone (they work without JS). If the app hasn't started
within 10 s, held clicks are dropped and the page behaves natively. While a click is held, the wrapper has
`data-pending` (e.g. `[data-pending] { cursor: progress }`). Clicks made while the HTML is still being
parsed, before that script runs, aren't caught.

Prerendered pages show the app's starting state (no saved data, default theme toggle). Pages that load
data from `/api` get what the dev `api/` returned *during the build* baked in: the HTML, and the JSON answers
of the GETs the page made (a `#mini-data` script). When the app starts, the first `fetchJSON` of each of
those URLs uses its baked answer instead of a request, so the data on screen isn't swapped for "Loading…"
(on a slow phone that flash lasted a whole round trip). Answers are used once, and the ones startup didn't
use are dropped, so a refetch, a search or "Load more" always asks the server. The baked data is from build
time, so rebuild to refresh it. Routes that redirect (a `redirect`, or the
guard sending a signed-out build visitor away) are left out on purpose (W063). A person added after the
build has no file until the next build (the SPA fallback still serves the page). Build warnings W060–W062
and W064–W066 name routes and URLs that couldn't be prerendered.

`npm run preview` serves it, and `npm run check -- --build` runs every check against it
(and checks every route was prerendered).
Measured in `../compare`: a bundled Mini app is ready 15–21% sooner than the same app in Vue on a slow phone.

### Deploying without a build

You can also deploy the project folder as it is, with no build tool. Copy `framework/mini/mini.min.js` to
`/mini/mini.min.js` on the host, then change two things in the deployed `index.html`: the import map
points at it, and it is Mini's only preload.

```html
<script type="importmap">{ "imports": { "mini": "/mini/mini.min.js" } }</script>
<link rel="modulepreload" href="/mini/mini.min.js">   <!-- instead of /mini/index.js, /mini/signal.js, ... -->
```

`mini.min.js` is the whole framework in one minified file, without the dev-only code (warnings, the
state recording): ~10 KB gzipped and one request, instead of ~30 KB in ten files. It's built once and
committed, so deploying needs nothing installed. `forDeploy(html)` in `tools/release.mjs` makes those
two edits. Keep `/mini/index.js` in development so warnings stay on. In `../compare`, a site deployed this
way is ready 3–15% sooner than Vue. It's 0–17% behind `npm run build`, which also bundles the app's own
files and prerenders.

Changing `mini/`? Run `node ../framework/tools/release.mjs` from `demo/` to rebuild the copy;
`npm run check` fails until you do.

The dev server sends `index.html` for unknown paths, so reloading on `/todos` works. `npm run preview`
sends `dist/404.html` (the plain app shell) instead, when it exists. On a real host, turn on the
"SPA fallback" for unknown paths and point it at `/404.html` (Netlify, GitHub Pages and Cloudflare Pages
use it automatically; nginx `try_files $uri $uri/index.html /404.html`, etc.).

## Built to be easy for AI (and beginners) to get right

- **`AGENTS.md`** (in the project) has the rules, patterns and workflow in one file. Claude Code,
  Copilot, Cursor and other AI tools read it automatically (`CLAUDE.md` points to it).
- **Every mistake has a code.** Messages like `[mini W001]` point to `docs/errors.md`, which shows the fix.
- **`npm run check` proves it works.** It runs:
  1. Node tests
  2. framework tests in Chrome
  3. the project's user flows (`tests/flows.js`) that click and type like a person
  4. every route in `app/router.js` (failing on errors, warnings, sideways scrolling at phone width, or
     accessibility problems: labels, button and link names, alt, ids, one `<h1>`, lang, and text contrast
     in the light and dark theme; see `tests/a11y.js`)
  5. a type check
  6. the framework's 10 KB size budget
  7. `index.html`'s `<link rel="modulepreload">` list: it must name exactly the modules the app loads at
     startup (without a build, a missing one costs a network round trip, an extra one wastes a download)

  Add `-- --json` for output tools can read.
- **`npm run see /path` lets you look without a browser.** It prints headings, links, buttons and
  inputs as text, flags layout overflow, and saves a screenshot to `.mini/screenshots/`.
- **The state is text too.** `npm run see /path --state` adds what the app holds, by variable name:
  ```
  route /todos
  store "mini-todos": todos = 3 items [{ id, text, done }, …], filter = "all"
  <todo-list>: draft = "", visible = computed · 3 items [{ id, text, done }, …], left = computed · 3
  ```
  A failing user flow prints the same block under the page outline, so an agent sees *why* a step
  failed without adding `console.log`s. In dev mode the core records it in `globalThis.__mini`
  (`mini/dev.js`); in production that code is removed (0 bytes). Names come from the setup or page
  function's source (`const draft = signal('')`); a value it can't name shows as `signal#2`.
- **JSDoc types**: editors autocomplete and flag mistakes (`count.valu` → "did you mean 'value'?"),
  while the files stay plain JavaScript.

Test pages can also be opened by hand while `npm run dev` runs: `/__mini/` (framework tests) and
`/__mini/flows.html` (the project's user flows).

## API

### Signals

```js
import { signal, computed, effect, batch } from 'mini';

const count = signal(0);
const double = computed(() => count.value * 2);
effect(() => console.log(double.value)); // logs 0, then on every change
count.value++;                           // logs 2
batch(() => { a.value = 1; b.value = 2; }); // effects run once
```

`effect` returns a dispose function, and can return a cleanup function itself.
`untrack(fn)` reads without subscribing; `root(fn)` creates an ownership scope you dispose manually.
`catchError(fn, handler)` runs fn in a scope; errors thrown in it, or later in effects/computeds made inside it,
go to `handler(err)` instead of throwing.

`selector(source)` is for "which one is selected" in a list (a selected row, the active tab):
```js
const isSelected = selector(selected);                         // selected: a signal holding an id
html`<tr class=${() => (isSelected(row.id) ? 'selected' : '')}>`
```
Changing `selected` re-runs only the two rows whose answer changed, not every row, as
`selected.value === row.id` would. In the benchmark that makes selecting a row 3× faster than React.

### Templates

```js
import { html, repeat } from 'mini';

html`
  <p>${name}</p>                       <!-- text, always escaped -->
  <p>${() => count.value * 2}</p>      <!-- function/signal = updates in place -->
  <a href=${url} class=${cls}>link</a> <!-- attribute -->
  <button ?disabled=${busy}>Go</button><!-- boolean attribute -->
  <input .value=${text}>               <!-- property -->
  <button @click=${onClick}>+</button> <!-- event -->
  <input ref=${(el) => el.focus()}>    <!-- element reference -->
  <ul>${repeat(items, (i) => i.id, (i) => html`<li>${i.name}</li>`)}</ul>
`;
```

An attribute hole must be the whole value: `class=${x}`, not `class="a ${x}"`
(build the string in JS instead: ``class=${`a ${x}`}``).

**Lists.** `repeat(items, key, row)` keeps each row's DOM while its key stays, and moves rows instead of
rebuilding them. A row is built once from its item, so an item replaced by a new object
(`{ ...item, label }`) gets its row rebuilt. That's right for most lists. For a **big list whose rows change
often** (a live table, a feed), make the field that changes a signal and write to it in place:

```js
const rowsOf = (data) => data.map((r) => ({ id: r.id, label: signal(r.label) }));
html`${repeat(rows, (r) => r.id, (r) => html`<tr><td>${r.label}</td></tr>`)}`;
batch(() => rows.value.forEach((r, i) => i % 10 === 0 && (r.label.value += ' !!!'))); // only those texts change
```

Adding and removing rows still replaces the array (`rows.value = [...]`). Measured in `../compare`
("fine-grained rows"), updating every 10th of 1,000 rows took 14.4 ms instead of 22.0 (React 15.1, Vue 17.4),
for ~70% more memory (each row holds a signal and an effect: 16 MB at 10,000 rows instead of 9).
So use it for the fields that change, in lists that are big and busy, not by default.

### Components

```js
import { define, html, signal } from 'mini';

define('my-counter', (props, ctx) => {
  const count = signal(Number(props.start.value) || 0);
  ctx.onMount(() => {
    const id = setInterval(() => count.value++, 1000);
    return () => clearInterval(id); // runs when the element is removed
  });
  return html`<button @click=${() => count.value++}>${count}</button>`;
}, { props: ['start'] });
```

```html
<my-counter start="5"></my-counter>
```

- `props.x` is a signal fed by the `x` attribute or the `el.x` property.
- `ctx`: `host`, `children` (original child nodes), `slot(name?)`, `onMount`, `onCleanup`, `emit(type, detail)`.
- Options: `{ props: [], shadow: false, styles: '', fallback }` (`styles` applies with `shadow: true`).
- `ctx.slot('name')`: the original children with `slot="name"`; `ctx.slot()`: the rest (blank text dropped).

```js
define('info-card', (props, ctx) => html`
  <article class="card">
    <header>${ctx.slot('title')}</header>
    ${ctx.slot()}
    <footer>${ctx.slot('actions')}</footer>
  </article>
`);
```

**Context**: share a value with every component inside, without passing props down.

```js
import { define, provide, inject, signal } from 'mini';

define('theme-box', (props, ctx) => {
  provide('theme', signal('dark'));   // inside setup
  return html`${ctx.children}`;
});
define('theme-label', () => {
  const theme = inject('theme', signal('light')); // nearest provider above, or the fallback
  return html`<span>${theme}</span>`;
});
```

**Errors**: if setup or one of its `${}` holes throws, the component shows a fallback instead of breaking the page.
The default is an alert with a "Try again" button (and a `console.error`); pass your own with
`fallback: (err, retry) => html`...`` (nothing is logged). Errors in its event handlers count too: an `@click`
that throws, or an `async` one whose promise rejects, shows the same fallback (in a page outside any
component, the page's error view). Event handlers attached with your own `addEventListener` aren't covered.

```js
define('stock-price', setup, { fallback: (err, retry) => html`<p>Price unavailable <button @click=${retry}>Retry</button></p>` });
```

### Router

```js
import { createRouter, html } from 'mini';

const router = createRouter({
  '/': { title: 'Home', load: () => import('./pages/home.js') },        // lazy: page file has `export default`
  '/user/:id': { title: 'User', load: () => import('./pages/user.js') }, // gets { id }
  '/inline': () => html`<h1>Small page</h1>`,                           // eager: a view function
  '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
}, { title: (t) => `${t} · My site`, focus: '#main' });

html`<main id="main" tabindex="-1">${router.view}</main>`;
router.navigate('/user/42');
router.preload('/checkout'); // download a page's code ahead of time
```

**Lazy loading:** a `load` route downloads its page's code only on first visit. Pointing at, focusing or
touching a link starts the download early, so the click usually feels instant. The current page stays
on screen until the next one is ready, a slow page can't overwrite a newer click, and a failed download
shows an error with "Try again". Options: `prefetch: false`, and `loading: () => html`...`` for the
first-visit placeholder.

Same-origin `<a>` clicks are handled automatically. Add `data-reload` to a link for a full page load.
Page changes animate with View Transitions where supported (skipped with reduced motion and on back/forward).
A page that throws (while rendering or later in a hole) shows the same "This page didn't load" view with
"Try again", and the rest of the app keeps working. Components with their own `fallback` catch first.
`router.ready` resolves once the first page's code (and layout) has loaded or failed.

```js
const settingsLayout = { load: () => import('./layouts/settings.js') };

const router = createRouter({
  '/': { title: 'Home', load: () => import('./pages/home.js') },
  '/old-pricing': { redirect: '/pricing' },
  '/u/:id': { redirect: ({ id }) => `/user/${id}` },
  '/account': { title: 'Account', load: () => import('./pages/account.js'), auth: true },
  '/settings/profile': { title: 'Profile', layout: settingsLayout, load: () => import('./pages/profile.js') },
  '/settings/billing': { title: 'Billing', layout: settingsLayout, load: () => import('./pages/billing.js') },
  '*': { title: 'Not found', load: () => import('./pages/not-found.js') },
}, {
  guard: (to) => (to.route.auth && !store.user.value ? `/login?next=${encodeURIComponent(to.path)}` : true),
});

// layouts/settings.js
export default (page) => html`<div class="settings"><nav>…</nav><section>${page}</section></div>`;

router.query.value.q;                     // ?q=ann → 'ann'
router.setQuery({ q: 'bo', page: null }); // update the URL without re-rendering the page
```

**Query string:** `router.query` is the URL's `?search` as an object and updates on every navigation
(a repeated key keeps its last value). `router.queryAll('tag')` gives every value of a repeated key
(`?tag=a&tag=b` → `['a', 'b']`), reactively. `router.setQuery(obj)` merges into the URL (`null`, `''` or `[]`
removes a key; an array writes the key once per value) without re-rendering the page, replacing the
history entry; pass `{ replace: false }` to make it a back-button step.

**Redirects and guards:** `redirect` sends a route elsewhere. `guard(to)` runs before every page change
(first load, links, `navigate()`, back/forward) with `{ path, params, query, route }` (`route` includes
custom fields like `auth`); return `true` to allow it or a path to go there instead. Guards are synchronous.
Redirects replace the history entry, so back doesn't bounce.

**Sign-in that the server checks:** ask the server once, at the top of `app/router.js`, before
`createRouter`. The first guard runs as soon as the router is created, and a top-level `await` holds the
app's start until the answer is in. After that the guard reads a signal, so it can stay synchronous:

```js
// app/router.js
import { createRouter, fetchJSON } from 'mini';
import { session } from './store.js'; // createStore({ user: null })

session.user.value = await fetchJSON('/api/me').catch(() => null); // 401 or offline → signed out

export const router = createRouter(routes, {
  guard: (to) => (to.route.auth && !session.user.value ? `/login?next=${encodeURIComponent(to.path)}` : true),
});
// After signing in or out: set session.user.value, then router.navigate(...)
```

Per-item permission (may this user open `/projects/42`?) belongs in the page, not the guard: load it with
`resource()` and show a "No access" view for a 403, like a "not found" page for a 404. A guard only picks
which page to show; the API must refuse unauthorized requests itself.

**Scroll:** links scroll to the top (or to `#id` on the new page); back/forward put the scroll position back.

**Layouts:** `layout: (page) => html`...${page}...`` wraps a page. Pages that share the same layout keep
it mounted while you move between them, so its state (open menus, inputs, scroll in a side nav) survives.
`layout: { load: () => import('./layouts/x.js') }` loads it lazily (default export), together with the page.

### Store

```js
import { createStore } from 'mini';
const store = createStore({ todos: [] }, { persist: 'my-key' }); // saved to localStorage
store.todos.value = [...store.todos.value, item];
const session = createStore({ user: null }, { name: 'session' }); // not saved; `name` labels it in --state
```

A persisted store stays in step across the browser's tabs: when another tab of the same site saves it,
this tab's signals take the new values (and the page updates), without a reload. A key the other tab's
save lacks goes back to its initial value, and clearing localStorage resets the store. `name` is only
for `npm run see --state` (default: the `persist` key, else `"store"`).

### Data loading

```js
import { resource, fetchJSON } from 'mini';

const query = signal('');
const users = resource(({ signal }) => fetchJSON(`/api/users?q=${query.value}`, { signal }));

html`${users.render((list) => html`<ul>${list.map((u) => html`<li>${u.name}</li>`)}</ul>`)}`;
users.render({ loading: () => ..., error: (err, retry) => ..., ready: (list) => ... }); // custom views
users.loading.value;   // true during any request
users.refetch();       // run again
users.mutate(data);    // replace locally
```

- Signals the fetcher reads before its first `await` are tracked. When they change, the old request is
  **aborted** and a new one starts. A late reply from an old request is ignored.
- While refetching, the previous data stays on screen. Removing the component aborts its request.
- `fetchJSON(url, { json })` sends JSON (POST by default), parses the reply, and throws `HttpError`
  (`err.status`, `err.body`) for non-2xx responses.

```js
import { paginated } from 'mini';

// Optimistic update: show the change now, undo it if the save fails (the error is rethrown).
await todos.optimistic(
  (list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
  () => fetchJSON(`/api/todos/${id}`, { method: 'PATCH', json: { done: true } }) // a returned value replaces the data
);

// Pages: the fetcher gets { page, next, signal } and returns an array or { items, next }.
const people = paginated(({ page, signal }) => fetchJSON(`/api/team?page=${page}&q=${query.value}`, { signal }), { pageSize: 20 });
html`${people.render((list) => html`<ul>${repeat(list, (p) => p.id, (p) => html`<li>${p.name}</li>`)}</ul>`)}
  ${() => people.hasMore.value && html`<button class="btn" ?disabled=${people.loadingMore} @click=${people.loadMore}>Load more</button>`}`;
```

- `optimistic(update, save)` keeps several saves in flight safely: a failed save undoes only its own
  update. `update` must be pure (it may run again when newer data arrives).
- `paginated` ends when an array page is shorter than `pageSize` (or empty) or `next` is null. Changing a tracked
  signal or calling `refetch()` starts again from page 1. A failed `loadMore()` keeps the loaded items and
  sets `people.error`; call `loadMore()` again to retry. Also: `items`, `loading`, `loadingMore`, `hasMore`.

### Forms

```js
import { form, rules } from 'mini';

const f = form({
  initial: { email: '', agree: false },
  validate: { email: [rules.required(), rules.email()], agree: rules.required() },
  onSubmit: async (values) => fetchJSON('/api/signup', { json: values }),
});

html`<form novalidate @submit=${f.submit}>
  ${f.input('email', { label: 'Email', type: 'email' })}
  ${f.checkbox('agree', { label: 'I agree' })}
  <button ?disabled=${f.submitting}>Send</button>
</form>`;
```

- Field helpers (`input`, `textarea`, `select`, `checkbox`) render a label, the control and its error,
  wired with `for`/`id`, `aria-invalid` and `aria-describedby`. An optional `hint` (text, or a function
  for live text such as `() => `${f.fields.notes.value.length}/200``) is linked the same way.
- Errors show after a field is left (blur) or a submit is tried. A submit with errors focuses the
  first bad field and skips `onSubmit`.
- If `onSubmit` throws an error with `body.errors = { field: message }` (e.g. a 422 `HttpError`),
  the messages show under those fields. Editing a field clears its server error. Other errors go to `f.submitError`.
- Rules: `required`, `minLength`, `maxLength`, `email`, `pattern`, `min`, `max`, `sameAs`, or any
  `(value, values) => message | null`.
- Also: `f.fields.email` (signal), `f.values()`, `f.error('email')`, `f.valid`, `f.reset()`, `f.setErrors({...})`.

### Dialogs and toasts

Not part of Mini: the browser's `<dialog>` (modal, Esc, focus trap) and `popover` do the hard parts, and
each app wants its own look. The demo's `app/ui.js` (`dialog`, `confirm`, `toast`, with its CSS under
"UI helpers" in `styles/main.css`) is an accessible starting point to copy and restyle.

### Dev API (dev server only)

`api/<name>.mjs` in the project answers `/api/<name>`. Export functions named after HTTP methods. They
get `{ query, body, method }` and return data (200 JSON) or a `Response` (any status):

```js
export async function POST({ body }) {
  if (!body?.email) return Response.json({ errors: { email: 'Required' } }, { status: 422 });
  return { ok: true };
}
```
Static hosting doesn't run these. In production, a real backend must answer the same URLs.

### Animations

Use the browser, not a library. CSS `transition` covers hover and open/close, `@starting-style` covers
items appearing, and the router already animates page changes. For items **removed or reordered**, wrap
the change in `transition()` and give each row its own `view-transition-name`: the browser snapshots the
list before and after, fades out what left and slides what moved.

```js
import { transition } from 'mini';
const remove = (id) => transition(() => (todos.value = todos.value.filter((t) => t.id !== id)));
// each row: <li style=${`view-transition-name: todo-${t.id}`}>   (names must be unique on the page)
```

`transition(update)` uses View Transitions when the browser has them and the user hasn't asked for
reduced motion; otherwise it just runs `update`. `update` always runs exactly once, within 300 ms even if
the browser holds the transition back (it may in a background tab), so an animation never stops a change.
Use it rather than calling `document.startViewTransition` yourself, which can stall.

## Dev warnings

On `localhost`, Mini prints `[mini W…]` warnings for common mistakes (each message once). They are
off on any other host. Force them with `globalThis.MINI_DEV = true/false` before importing mini.
Errors (`E…`) are always thrown. The full list with fixes is in [docs/errors.md](docs/errors.md).

## Browser support

Current Chrome, Edge, Firefox and Safari. No Internet Explorer.
