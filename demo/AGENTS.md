# AGENTS.md: how to work on a Pith app

You are working on a site built with **Pith**, a tiny framework that runs directly in the browser.
There is **no build step and no runtime dependencies**. Files are served exactly as written.
The framework and its tools come in one dev dependency, `pithjs` (in `node_modules/pithjs/`).
Run every command from the project folder. Read this file fully before changing code.
Requires Node 24+ and Chrome/Chromium for checks.

## The loop (always)

1. Make a change.
2. Run `npm run check`. Read every ✗ line. Each `[pith W…]`/`[pith E…]` message has a fix in `node_modules/pithjs/docs/errors.md`.
3. To see a page, run `npm run see /path`. It prints the page as a text outline and saves a screenshot you can open.
   Add `-- --state` to also print what the route, stores, page and each component hold (by variable name).
   A failing flow prints that state too, under the page outline: read it before changing code.
   `-- --mobile`, `--dark` and `--full` (the whole page) take the other screenshots a design review needs.
   It uses your running `npm run dev` server when there is one, so it shows the same data you see (`--fresh` for a new server).
4. Done only when `npm run check` prints **All good**. Never claim something works without that.

**UI work** (pages, components, forms, anything a person sees): follow the two skills in `.claude/skills/`:
`pith-frontend` (every state of a view, and which Pith tool handles it) and `pith-design` (layout, the design
system, and looking at screenshots before you're done). Claude Code loads them by itself; other agents: read
those `SKILL.md` files before starting UI work.

`npm run check -- --json` gives the same result as JSON.

## Commands

| Command | What it does |
|---|---|
| `npm install` | once: installs Pith's tools (`pithjs`) and Vite, the two dev dependencies |
| `npm run dev` | Vite dev server on :8000 (`PORT=3000` for another port): reloads on save, CSS updates in place |
| `npm run dev:no-build` | the same app with no Vite at all |
| `npm run build` | production build with Vite into `dist/` (bundled, minified, dev warnings removed), then each route prerendered to `dist/<route>/index.html` (`-- --no-prerender` to skip) |
| `npm run preview` | serve the built `dist/` locally (unknown paths get `dist/404.html`, the plain shell) |
| `npm run check -- --build` | build, then run every check against the built app (and check every route was prerendered) |
| `npm run check -- --browsers` | also run the framework tests and user flows in Firefox and WebKit (Safari). Needs `playwright-core` installed once (the check says how); skipped otherwise |
| `npm run check` | Node tests + framework tests + user flows + every route (also at phone width, and for accessibility in light and dark theme) + type check + the framework's 10 KB size budget + `index.html` preloads match what loads at startup |
| `npm run types` | only the JSDoc type check (TypeScript via npx, nothing installed) |
| `npm run see /todos [--mobile] [--state]` | text outline of the page + screenshot in `.pith/screenshots/` (`--state`: what the app holds) |
| `npm run new page <name> [--nav]` | new page file + lazy route (+ nav link) |
| `npm run new component <tag-name>` | new component file |

## Where things go

```
app/main.js        mounts the app shell (after `await router.ready`, so prerendered HTML doesn't flash empty)
app/router.js      the route table: one lazy line per page
app/store.js       shared state (signals, saved to localStorage)
app/pages/*.js     one page per file: export default function XxxPage(params) { return html`...` }
app/components/*.js  one component per file: define('tag-name', setup)
styles/main.css    all CSS. Use the existing tokens (var(--accent), etc.) and classes.
api/*.mjs          optional fake backend for development: api/users.mjs answers /api/users (see "API" below)
prerender.mjs      URLs of :param pages to prerender (build only, runs in Node)
tests/flows.js     user flows: add one for each new feature

node_modules/pithjs/                  the framework and its tools. Don't edit it.
node_modules/pithjs/docs/errors.md    every warning/error code with its fix
node_modules/pithjs/README.md         the full API reference
```

Use `npm run new` instead of creating pages or components by hand. It also wires the route.

**Pages load lazily.** A page's code (and the components it imports) downloads only when the page is first
visited, or when the user points at a link to it. So:
- a page file **must** `export default` its function (E005), and
- a component is imported **by the page that uses it**, never from `main.js` (that would load it on every page).

## The 6 rules

1. **Import from `'pith'`**: `import { html, signal } from 'pith';` (an import map in `index.html` maps it to `/pith/index.js`). Dialogs and toasts are app code: `app/ui.js`.
2. **Reactive = signal or function as the whole hole.** `${count}` and `${() => count.value * 2}` update. `${count.value}` is a snapshot that never updates.
3. **Events take functions.** `@click=${() => save()}` ✓, but `@click=${save()}` ✗ (W001).
4. **Attribute holes are whole values.** `class=${cls}` ✓, but `class="btn ${cls}"` ✗ (E001). Build the string in JS instead: ``class=${`btn ${cls}`}``.
5. **Update arrays and objects immutably** so signals see the change:
   `todos.value = [...todos.value, item]` ✓, but `todos.value.push(item)` ✗ (nothing updates).
6. **Lists use `repeat()` with a stable unique key**: `${repeat(items, (i) => i.id, (i) => html`<li>${i.name}</li>`)}`.
   To mark the selected row or active tab, use `const isSelected = selector(selected)` and `isSelected(i.id)` in the row,
   not `selected.value === i.id` (that re-runs every row on each change).
   A row replaced by a new object is rebuilt. Only for a big list whose rows change often (a live table),
   make the changing field a signal (`{ id, label: signal('') }`, `${r.label}`) and set `r.label.value`
   (see node_modules/pithjs/README.md, Lists). It costs memory per row, so not by default.

## Patterns (copy these)

**Page** (`app/pages/contact.js`):
```js
import { html } from 'pith';
import '../components/contact-form.js'; // importing defines the tag

export default function ContactPage() {
  return html`
    <section class="section narrow">
      <h1>Contact</h1>
      <contact-form></contact-form>
    </section>
  `;
}
```

**Component with state, events, derived values, and a list:**
```js
import { define, html, repeat, signal, computed } from 'pith';

define('shopping-list', (props, ctx) => {
  const items = signal([]);
  const draft = signal('');
  const total = computed(() => items.value.length);

  const add = (e) => {
    e.preventDefault();
    if (!draft.value.trim()) return;
    items.value = [...items.value, { id: crypto.randomUUID(), name: draft.value.trim() }];
    draft.value = '';
  };

  return html`
    <form @submit=${add}>
      <label for="item">Item</label>
      <input id="item" class="input" .value=${draft} @input=${(e) => (draft.value = e.target.value)}>
      <button class="btn primary">Add</button>
    </form>
    <ul>${repeat(items, (i) => i.id, (i) => html`<li>${i.name}</li>`)}</ul>
    <p>${total} items</p>
    ${() => (total.value === 0 ? html`<p class="empty">Empty</p>` : null)}
  `;
});
```

**Props** (attributes): `define('user-card', (props) => html`<p>${props.name}</p>`, { props: ['name'] })`
then `<user-card name="Ann"></user-card>`. Prop names are lowercase or kebab-case (W009).

**Lifecycle:** `ctx.onMount(() => { const id = setInterval(tick, 1000); return () => clearInterval(id); })`.

**Slots** (named parts of a component's children):
```js
define('info-card', (props, ctx) => html`
  <article class="card"><h2>${ctx.slot('title')}</h2>${ctx.slot()}</article>
`);
// <info-card><span slot="title">Hi</span><p>Body</p></info-card>
```

**Context** (instead of passing a prop through every level): `provide('key', value)` in the outer component's
setup, `inject('key', fallback)` in any component inside it. Both only work inside setup (W030, W031).
Provide a signal if the value changes.

**Errors:** a component or page that throws (in setup or a `${}` hole) shows an error with a "Try again"
button, and the rest of the app keeps working. Custom view: `define('x-y', setup, { fallback: (err, retry) => html`...` })`.
Don't wrap setup in try/catch yourself. This includes `@click` handlers (and rejected `async` ones): their errors show the same fallback.

**Shared state:** put it in `app/store.js` with `createStore({ key: initial }, { persist: 'storage-key' })`.
Read and write `store.key.value`. Persisted values must be plain JSON (W014). A persisted store follows
changes made in the user's other tabs by itself. Give an unsaved store a `name` (`{ name: 'session' }`) so
`--state` output can tell stores apart.

**Loading data: always use `resource()`**, never a hand-written `fetch` with your own loading/error signals:
```js
import { html, signal, resource, fetchJSON } from 'pith';

const query = signal('');
// Signals read here (query) re-run the request when they change; the old request is cancelled.
const users = resource(({ signal }) => fetchJSON(`/api/users?q=${encodeURIComponent(query.value)}`, { signal }));

html`${users.render((list) => html`<ul>${list.map((u) => html`<li>${u.name}</li>`)}</ul>`)}`;
// Shows "Loading…", then the list, or an error with a "Try again" button. Custom views:
// users.render({ loading: () => ..., error: (err, retry) => ..., ready: (list) => ... })
```
Also: `users.loading.value` (true during any request, e.g. an "Updating…" hint), `users.refetch()`,
`users.mutate(newData)` (after a save), or `users.mutate((data) => next)` to change the confirmed data
while an `optimistic` save may be pending (a value built from `users.data.value` would repeat it).
`fetchJSON(url, { json: body })` POSTs JSON and throws `HttpError` (with the server's JSON on `err.body`).
`render()` builds its ready view again on every data change; for a view that changes often (a chat, a live
feed), use `users.live(...)`: the same views, but `ready` is built once and gets the data as a signal, so
`repeat(list, ...)` inside it patches instead of rebuilding. `paginated()` has `live` too.

**Long lists load in pages** (don't fetch everything):
```js
import { paginated, fetchJSON, repeat } from 'pith';
const people = paginated(({ page, signal }) => fetchJSON(`/api/team?page=${page}`, { signal }), { pageSize: 5 });
html`${people.render((list) => html`<ul>${repeat(list, (p) => p.id, (p) => html`<li>${p.name}</li>`)}</ul>`)}
  ${() => people.moreError.value && html`<p role="alert">${people.moreError.value.message}</p>`}
  ${() => people.hasMore.value && html`<button class="btn" ?disabled=${people.loadingMore} @click=${people.loadMore}>Load more</button>`}`;
```
The fetcher returns an array or `{ items, next }` (W040). `people.status` is page 1's; change loaded rows
locally with `people.mutate((items) => next)`. **Instant feedback on save**:
`await res.optimistic((data) => newData, () => fetchJSON(...))`. It rolls back and rethrows on failure,
so inside a form's `onSubmit` the error shows as `submitError`.

**Forms: always use `form()`.** It handles values, validation, accessible errors, submitting and server errors:
```js
import { html, signal, form, rules, fetchJSON } from 'pith';

const signup = form({
  initial: { email: '', password: '', plan: 'free', terms: false },
  validate: {
    email: [rules.required(), rules.email()],
    password: [rules.required(), rules.minLength(8)],
    terms: rules.required('Please accept the terms'),
  },
  onSubmit: async (values) => {
    await fetchJSON('/api/signup', { json: values }); // a 422 { errors: { email: '...' } } shows under Email
    router.navigate('/welcome');
  },
});

html`
  <form class="card form" novalidate @submit=${signup.submit}>
    ${signup.input('email', { label: 'Email', type: 'email', autocomplete: 'email' })}
    ${signup.input('password', { label: 'Password', type: 'password', hint: 'At least 8 characters' })}
    ${signup.select('plan', { label: 'Plan', options: [['free', 'Free'], ['pro', 'Pro']] })}
    ${signup.checkbox('terms', { label: 'I accept the terms' })}
    ${() => (signup.submitError.value ? html`<p class="form-error" role="alert">${signup.submitError.value.message}</p>` : null)}
    <button class="btn primary" type="submit" ?disabled=${signup.submitting}>Sign up</button>
  </form>
`;
```
Field helpers: `input` (any `type`), `textarea`, `select`, `checkbox`. Each takes an optional `hint`
(text under the field, linked with `aria-describedby`); a function makes it live, e.g. a counter:
`f.textarea('notes', { label: 'Notes', hint: () => `${f.fields.notes.value.length}/200` })`. Rules: `required`, `minLength`,
`maxLength`, `email`, `pattern(re, msg)`, `min`, `max`, `sameAs('password')`, or your own
`(value, values) => message | null`. Errors show after a field is left or a submit is tried, and on
submit focus moves to the first bad field. Also: `signup.values()`, `signup.reset()`,
`signup.setErrors({ email: '...' })`, `signup.valid.value`. Every field name must be in `initial` (W015, W016).

**Animating items in, out and around:** put `class="motion"` on the container and wrap the change in
`transition(() => (todos.value = ...))`: its children fade in, fade out and move, and what's around them glides.
Nest it (on the list, and on the section around it) to choose what moves. A row rebuilt in another list (a card
moved to another column) needs `style=${`view-transition-name: card-${c.id}`}` to slide there.
Don't add an animation library, and don't call `document.startViewTransition` yourself (it can stall).

**Confirm, dialogs and toasts: use `app/ui.js`** (this app's own helpers, on the browser's `<dialog>` and popover), never `window.confirm`/`alert`:
```js
import { confirm, dialog, toast } from '../ui.js';   // from app/components or app/pages

const clearDone = async () => {
  if (!(await confirm('Clear completed todos?', { ok: 'Clear', danger: true }))) return;
  store.todos.value = store.todos.value.filter((t) => !t.done);
  toast('Cleared');                                 // { type: 'success' | 'error', timeout: 0 = stays }
};
// Custom dialog: start it with a heading (its accessible name) and resolve with close(value).
const value = await dialog((close) => html`<h2>Pick</h2>
  <button class="btn" type="button" @click=${() => close('a')}>A</button>`);
```
Import `app/ui.js` in the page or component that uses it (not in `main.js`).
Flows: `await app.click('Clear completed'); await app.click('Clear'); await app.see('Cleared');`.

**API** (`api/<name>.mjs`, dev server only): export functions named after HTTP methods.
```js
// api/signup.mjs → POST /api/signup
export async function POST({ body, query }) {
  if (!body?.email) return Response.json({ errors: { email: 'Required' } }, { status: 422 });
  return { ok: true };   // plain data → 200 JSON
}
```
Always validate on the server too. **Static hosting doesn't run `api/`**: production needs a real backend
that answers the same URLs.
`npm run build` prerenders pages with the data `api/` returned during the build, and the page's first
`fetchJSON` of each URL reuses it (no "Loading…" flash on start). Later requests need a real backend.

**Routes** (`app/router.js`), one line per page. Params arrive as the page function's argument:
```js
'/user/:id': { title: 'User', load: () => import('./pages/user.js') },
// app/pages/user.js
export default function UserPage({ id }) { return html`<h1>User ${id}</h1>`; }

'/settings/profile': { title: 'Profile', layout: settings, load: () => import('./pages/profile.js') },
'/old': { redirect: '/new' },
// createRouter(routes, { guard: (to) => (to.route.auth && !session.user.value ? '/login' : true) })
```
Guards are synchronous. If the server decides who's signed in, ask it once at the top of `app/router.js`,
before `createRouter`: `session.user.value = await fetchJSON('/api/me').catch(() => null);`. Then update
`session.user` on sign-in/out. Per-item access (`/projects/42`) goes in the page: `resource()` + a "No access"
view on a 403. Never rely on a guard for security: the API must check too.
Layouts: `const settings = { load: () => import('./layouts/settings.js') }` with
`export default (page) => html`<nav>…</nav>${page}`` (E005 if there's no default export).
Pages sharing a layout keep it mounted. Read the URL's `?query` with `router.query.value.q`; change it
with `router.setQuery({ q })` (no re-render). Use it for filters and search boxes, so a reload or shared link keeps them.
For a repeated key (`?tag=a&tag=b`): `router.queryAll('tag')` → `['a', 'b']`, and `router.setQuery({ tag: ['a', 'b'] })`.
Navigate in code with `router.navigate('/path')` (import `router` from `app/router.js`). Plain `<a href="/path">` links just work.
`router.preload('/checkout')` downloads a page's code ahead of time (e.g. the next step of a form).
If a page's code fails to load, or a page crashes, the router shows an error with a "Try again" button.
Your own (e.g. branded) view: `createRouter(routes, { error: (err, retry) => html`...` })`; the 404 page is the `'*'` route.

**Prerendering `:param` pages** (`prerender.mjs`, next to `index.html`, optional): list the real URLs for
`npm run build` to turn into HTML files. It runs in Node at build time, like `api/*.mjs`:
```js
import { team } from './api/team.mjs';                       // export the data from the api file
export default async () => team.map((p) => `/team/${p.id}`); // → dist/team/1/index.html, ...
```
Return plain paths (`/team/3`, not `/team/:id`, no `?` or `#`); each must match a route (W064).
A page for an unknown id should still render an `<h1>` (e.g. "No such person") on that URL.

## Template hole reference

| Write | Meaning |
|---|---|
| `${value}` | text (always escaped, safe for user input) |
| `${signal}` / `${() => expr}` | text or HTML that updates in place |
| `${html`...`}` / `${[a, b]}` | nested template / list of nodes |
| `${svg`<text>…</text>`}` | a nested piece of an `<svg>` (`html` would make it HTML, which never shows) |
| `name=${v}` | attribute (`null`/`false` removes it) |
| `?disabled=${v}` | boolean attribute |
| `.value=${v}` | DOM property (use for input values, `.checked`) |
| `@click=${fn}` | event listener |
| `ref=${(el) => ...}` | get the element |

No `${}` inside `<textarea>`, `<title>`, `<style>` or comments (E002).

## Writing user flows (`tests/flows.js`)

Find things the way a person does, by visible text or label, not by CSS class:

```js
import { flow } from 'pith/testing';

flow('contact: sending the form shows a thank-you', async (app) => {
  await app.go('/contact');
  await app.type('Email', 'ann@example.com');   // by <label>, placeholder or aria-label
  await app.click('Send');                      // by button/link text or aria-label
  await app.see('Thank you');                   // waits up to 3s
  await app.notSee('Error');
  await app.expectPath('/contact');
  app.expect(app.query('#email').value === '', 'the form should reset');
});
```
Also available: `app.select('Status', 'Churned')` (dropdown by label, option by text), `app.pressEnter()`, `app.hear(text)` (a screen-reader announcement; `see()` skips `sr-only` text), `app.back()`, `app.query(sel)`, `app.queryAll(sel)`, `app.outline()`.
A failing step prints the whole page as an outline, so you can see what is actually there.

## Accessibility (required, and it makes flows work)

- Every input has a `<label for>` (use class `sr-only` to hide it visually) or an `aria-label`.
- Icon-only buttons get `aria-label`. Buttons have `type="button"` unless they submit a form.
- One `<h1>` per page. `npm run check` fails a route that renders none.
- Pages must not scroll sideways on a phone (390px). `npm run check` names the element that sticks out.
- Text contrast is at least 4.5:1 (3:1 for large text), in both themes. Fix it in the CSS tokens (`--muted`, etc.), not per element.
- `npm run check` enforces all of these on every route (plus `alt` on images, unique ids, `<html lang>`), and
  `npm run see /path` lists them under "Accessibility".

## Don'ts

- Don't add npm packages or TypeScript files. Types are JSDoc comments in `.js` files.
  `pithjs` and Vite are the only dev dependencies (tools, `npm run dev` and `npm run build`). App code imports `'pith'` only.
- Don't set `innerHTML` with data. Use `html` holes, which escape it.
- Don't edit `node_modules/pithjs/` to fix an app bug. If Pith itself is really wrong, write a user flow that
  shows it, and report it.
- Don't write your own fetch + loading/error signals or form validation. Use `resource()` and `form()`.
- Don't use `window.confirm`/`alert`. Use `app/ui.js`, and extend it there if you need more.
- Don't use `document.querySelector` to update the UI. Change a signal and let the template update.

## This app: the Pith demo

This demo lives in the Pith repo, so `pithjs` is linked from `../framework` (`"pithjs": "file:../framework"`):
framework changes show up here at once. To change the framework itself, follow `../CLAUDE.md` and
`../framework/CONTRIBUTING.md`, not the "don't edit" rule above. Everything above this section is
`../framework/AGENTS.md`, the copy every new project gets (a test keeps the two in sync).

The site is **Home** (`/`, the landing page) and **Docs** (`/docs`, `/docs/<page>`):
- Docs pages are listed in `app/docs/index.js` (sidebar order, title, summary, and an optional live `example`
  or `app`). Each page's body is `app/docs/pages/<name>.js` (`export default () => html`...``, no `<h1>`: the
  frame in `app/pages/doc.js` adds it) built with the helpers in `app/docs/ui.js` (`code`, `api`, `note`, `c`).
  A flow opens every docs page.
- Live examples are files in `app/examples/` listed in `app/examples/index.js`; after changing one, run
  `npm run examples` to refresh `app/examples/sources.js` (the code shown on its page; a test fails while it's stale).
- Example apps open full width under a "← Docs" bar, each with a docs page: Chat (`/chat/:room`, `api/chat.mjs`),
  Inbox (`/inbox/:folder`, `api/inbox.mjs`), Kanban (`/kanban`, a persisted store), Dashboard (`/dashboard`,
  `api/dashboard.mjs`) and Settings (`/settings/*`, a layout and a sign-in guard). `app/apps.js` lists them.
- Benchmarks (`/docs/benchmarks`) read `app/data/benchmarks.js`, written by `npm run benchmarks` from
  `../compare/results/measure.json`.
- Older URLs (`/features/...`, `/examples`, `/benchmarks`, `/todos`, `/about`) redirect into the docs.
