# Pith errors and warnings

Every message looks like `[pith W001] ... See docs/errors.md#w001`.
**Warnings** (`W`) show only on localhost. **Errors** (`E`) are thrown everywhere, because the output would be wrong.
Each entry shows the mistake, the fix, and why.

---

## W001
**An `@event` hole got something that isn't a function.**

```js
html`<button @click=${count.value++}>+</button>`        // ✗ runs once while rendering
html`<button @click=${() => count.value++}>+</button>`  // ✓ runs on each click
```
The value is evaluated when the template is built. Wrap the code in `() => ...`.

## W002
**A plain object was put in a text hole and would show as `[object Object]`.**

```js
html`<p>${user}</p>`        // ✗
html`<p>${user.name}</p>`   // ✓
```

## W003
**A signal or function was nested inside an array, or returned from a function.**
Only a signal or function that is the *whole* `${}` hole updates in place.

```js
html`<p>${[count, ' items']}</p>`                 // ✗ the signal is ignored
html`<p>${count} items</p>`                       // ✓
html`<p>${() => `${count.value} items`}</p>`      // ✓
```

## W004
**`repeat()` was used inside an array or returned from a function.** It must be the whole hole.

```js
html`<ul>${() => repeat(todos, ...)}</ul>`   // ✗
html`<ul>${repeat(todos, ...)}</ul>`         // ✓ repeat already reacts to the signal
```
To hide the whole list, wrap the `<ul>` instead: `${() => show.value ? html`<ul>${repeat(...)}</ul>` : null}`.

## W005
**`repeat()` saw the same key twice.** Rows with duplicate keys go missing.
Use a stable unique id: `(t) => t.id`. Create ids with `crypto.randomUUID()`. Don't use the array index.

## W006
**A custom element tag in a template is not defined** one second after rendering.
Either the tag name is misspelled, or the file that calls `define('the-tag', ...)` was never imported.

```js
import '../components/todo-list.js';  // ✓ importing the file defines the tag
```

## W007
**A component's setup returned nothing**, so it renders empty. Usually a missing `return`:

```js
define('my-card', () => { html`<div>...</div>`; });          // ✗
define('my-card', () => html`<div>...</div>`);               // ✓
define('my-card', () => { const x = signal(0); return html`<div>${x}</div>`; }); // ✓
```

## W008
**A component's setup returned a function.** Setup runs once. Put reactive parts inside the template:

```js
define('my-clock', () => () => time.value);            // ✗
define('my-clock', () => html`<p>${time}</p>`);        // ✓
```

## W009
**A prop name has capital letters.** HTML attribute names are lowercase, so `<my-el userName="x">`
arrives as `username` and never reaches the prop. Use kebab-case: `props: ['user-name']`, read it as `props['user-name']`.

## W010
**`ref=${...}` got something that isn't a function.** Use `ref=${(el) => (inputEl = el)}`.

## W011
**A route pattern doesn't start with `/`.** Write `'/todos'`, not `'todos'`.

## W012
**A route has neither `load` nor a view.** Use `{ title: 'Todos', load: () => import('./pages/todos.js') }`
(recommended), or a view function `(params) => html`...``.

## W013
**There is no `'*'` route.** Unknown URLs fall back to plain "Not found" text. Add `'*': NotFoundPage`.

## W014
**A persisted store holds a value that JSON can't save.**
`Date`, `Map`, `Set`, functions and BigInt don't survive a reload. Store plain data instead:
a date as an ISO string (`new Date().toISOString()`), a Map or Set as an array.

## W015
**`form()` has a `validate` rule for a field that isn't in `initial`.** The rule never runs.
Add the field to `initial`, or fix the name: `form({ initial: { email: '' }, validate: { email: rules.email() } })`.

## W016
**A field helper (`f.input`, `f.textarea`, `f.select`, `f.checkbox`) names a field that isn't in `initial`**,
so it renders nothing. Add it: `initial: { notes: '' }`.

## W020
**Redirects kept going** (more than 10 steps), so the router stopped. A route's `redirect` or the
`guard` sends a URL to a place that sends it back:

```js
'/login': { redirect: '/' },  // ✗ with guard: (to) => (!loggedIn() ? '/login' : true), / and /login bounce
```
Make the guard return `true` for the page it redirects to (e.g. don't guard `/login`), and check that
no two redirects point at each other.

## W021
**A route's `layout` is not a function or `{ load }`.** Use `layout: (page) => html`<div>${page}</div>``
or `layout: { load: () => import('./layouts/settings.js') }` (with `export default`).

## W022
**The router guard returned something other than `true` or a path.** Returning `false` or nothing does
not block the page (it is shown). Return `true` to allow it or a path like `'/login'` to redirect.

## W030
**`provide()` was called outside a component's setup.** Nothing can inject the value.

```js
provide('theme', theme);                                   // ✗ at module level or in an event handler
define('theme-box', (props, ctx) => { provide('theme', theme); return html`${ctx.children}`; }); // ✓
```
For app-wide values, export a signal from `app/store.js` instead.

## W031
**`inject()` was called outside a component's setup**, so it returns the fallback.
Call it at the top of setup, not in an event handler, `onMount` or a `${() => ...}` hole:

```js
define('theme-label', () => {
  const theme = inject('theme', 'light');   // ✓ in setup
  return html`<button @click=${() => inject('theme')}>x</button>`;  // ✗ in a handler
});
```

## W040
**`paginated()`'s fetcher returned something that isn't an array or `{ items, next }`.**
The page is treated as empty and the last one. Return the array itself, or an object whose `items`
is an array (`next` = cursor for the following page, `null` when there is none). A common cause is
returning the whole JSON reply when the list is nested:

```js
paginated(({ page, signal }) => fetchJSON(`/api/team?page=${page}`, { signal }))                // ✗ { data: [...] }
paginated(async ({ page, signal }) => (await fetchJSON(`/api/team?page=${page}`, { signal })).data) // ✓
```

## W060
**A route showed the not-found page while prerendering**, so it wasn't prerendered (printed by `npm run build`).
The route key in `app/router.js` doesn't match its path. Fix the route pattern.

## W061
**A route rendered nothing into `#app` while prerendering**, so it wasn't prerendered.
`main.js` must render into `<div id="app">`.

## W062
**A route logged errors while prerendering**, so it wasn't written. The console lines follow the message.
Fix them (run `npm run check -- --build`); the route keeps the plain app shell until then.

## W063
**A route showed another page while prerendering**, so it wasn't written. It has a `redirect`, or the router
`guard` sent the build's (signed-out) visitor elsewhere. That's expected: writing it would show the wrong page
to visitors who are allowed in. The route gets the plain app shell. Detected by comparing the page's title
with the route's `title`, so give every route a `title`.

## W064
**A URL from `prerender.mjs` wasn't prerendered: it matches no route, or it showed the not-found page.**
Each URL must match a route key in `app/router.js` (`/team/3` matches `'/team/:id'`). Fix the URL or the
route. A page that shows its own "not found" view for an unknown id (with the route's title) is fine;
only the `'*'` page counts.

## W065
**`prerender.mjs` listed a URL that can't become a file**, so it was left out. URLs are strings that start
with a single `/`, with no `?query` or `#hash` (a file is per path), no `.`/`..` segments, no `%2F`, and no
`:` (list real URLs like `/team/3`, not the pattern `/team/:id`).

## W066
**`prerender.mjs` failed**, so no `:param` pages were prerendered. It must
`export default async function paths() { return ['/team/1', ...]; }`: a function (async is fine) that
returns an array. The message says whether it threw, had no default export, or returned something else.
`npm run check` reports it too.

---

## E001
**A template hole inside a tag is not a whole attribute value.**

```js
html`<div class="card ${size}">`          // ✗
html`<div class=${`card ${size}`}>`       // ✓ build the string in JS
html`<div ${attrs}>`                      // ✗ holes can't add attributes by name
```

## E002
**A `${}` sits where the browser doesn't parse HTML**: inside `<textarea>`, `<title>`, `<style>`,
`<script>` or an HTML comment. The value would never appear.

```js
html`<textarea>${text}</textarea>`        // ✗
html`<textarea .value=${text}></textarea>` // ✓
```
For the page title, set it in the route (`{ title: 'Todos', view }`) or with `document.title = ...`.

## E003
**Effects kept re-running each other** (more than 1000 rounds), usually because an effect writes
a signal that it also reads:

```js
effect(() => { count.value = count.value + 1; });   // ✗ infinite loop
const next = computed(() => count.value + 1);       // ✓ derive instead
```

## E004
**`define()` was called without a setup function.** Use `define('my-tag', (props, ctx) => html`...`)`.

## E005
**A lazy page file, or a lazy layout file (`layout: { load }`), has no default export.**
The router imports the file and calls its `default` export.

```js
export function TodosPage() { ... }          // ✗ named export only
export default function TodosPage() { ... }  // ✓
export default (page) => html`<nav>…</nav>${page}`;  // ✓ a layout file
```
The page shows "This page didn't load" with this message until it's fixed.
