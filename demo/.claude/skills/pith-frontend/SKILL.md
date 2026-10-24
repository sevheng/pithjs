---
name: pith-frontend
description: >
  Build or change UI in a Pith project: pages, components, forms, lists, data views, dialogs.
  Use it for any feature a person sees or clicks. It covers the workflow, every state a view must have
  (loading, empty, error, success, disabled), and which Pith tool handles each. Pair it with pith-design
  for the look.
---

# Building UI with Pith

AGENTS.md has the rules for using Pith correctly. This skill is about building a view that holds up when a real
person uses it: slow networks, empty data, mistakes, keyboards, phones.

## Workflow

1. **Look first.** `npm run see /the-page --state` shows what's there and what the page holds. Open a page
   with a similar job, and reuse its components, classes and wording.
2. **Build** with the patterns below. New page: `npm run new page <name> [--nav]`.
3. **Add a flow** in `tests/flows.js` for what a person does, including one unhappy path (an error, an empty list).
4. `npm run check` → **All good**. Read every ✗ line; error codes have fixes in `node_modules/pithjs/docs/errors.md`.
5. **Look at it** (pith-design): desktop, phone and dark screenshots. Done only after that.

## Every view has all its states

Before writing a view, list its states. Most bugs a person notices are a missing state, not a wrong one.

| State | What the person sees | In Pith |
|---|---|---|
| Loading | that something is coming, in the space the data will fill | `res.render({ loading: () => html`<p class="loading">Loading products…</p>`, … })`; `res.loading` for an "Updating…" hint during refetch |
| Error | what went wrong in plain words, and a way out | `error: (err, retry) => html`<div class="load-error" role="alert"><p>…</p><button class="btn" @click=${retry}>Try again</button></div>`` |
| Empty | why it's empty and what to do next | in `ready`: `list.length ? … : html`<p class="empty">No orders yet. <a href="/shop">Browse the shop</a></p>`` |
| Partial / more | that there's more, and the end | `paginated`: "Load more" while `hasMore`, disabled while `loadingMore`; say when it's everyone |
| Working | that the click registered | `?disabled=${f.submitting}` on the submit button; label `Saving…` while busy |
| Success | that it worked, where it matters | a `toast('Saved', { type: 'success' })` (from `app/ui.js`), or move to the result page |
| Invalid input | what to fix, next to the field | `form()` rules; server errors come back per field from a 422 `{ errors }`; `submitError` for the rest |
| Not allowed / gone | why, and where to go | the router guard redirects; a 403/404 from the API gets its own view in `ready`/`error` |
| Broken | the rest of the page still works | components: `define(tag, setup, { fallback })`; pages: `createRouter(routes, { error })` |

Write custom `loading`/`error`/empty text for the context ("Loading your orders…"), not the generic default, on
any view a person waits on.

## Data and saving

- **Always `resource()` / `paginated()`** for reads, `fetchJSON` for writes, never your own fetch + flags.
- **Views that change often** (a chat, a live feed, a big list you add to): `res.render(ready)` rebuilds the
  whole ready view on every data change, losing focus and scroll and costing time per row. Use
  `res.live(ready)` instead: `ready` is built once and gets the data as a signal; keep the list in `repeat()`
  over it (or a `computed` of it), and change it with `res.mutate((data) => next)`, which won't repeat a
  pending `optimistic` update. Same for `paginated()`: `list.live((items) => ...)`, `list.mutate((items) => next)`
  for local changes (star, read, remove), `list.status` for page 1 and `list.moreError` beside "Load more".
- **Charts drawn in code:** SVG pieces built in their own template (labels, a crosshair) use `` svg`...` ``,
  not `` html`...` `` (that makes `<text>` an HTML element that never shows).
- **Huge lists:** put the newest few hundred on screen and offer "Show older", like a chat; keep row
  templates inside one element (a `repeat()` row that starts with a hole leaks when removed).
- **Search and filters live in the URL:** `router.setQuery({ q })`, read `router.query.value.q`, so reload and
  shared links keep them. Signals the fetcher reads re-run it, and the old request is cancelled.
- **Instant feedback:** `await res.optimistic((data) => next, () => fetchJSON(...))` updates first, rolls back
  and rethrows on failure (inside `onSubmit` it shows as `submitError`).
- **Destructive actions ask first:** `if (!(await confirm('Delete "Plan A"?', { ok: 'Delete', danger: true }))) return;`
  Name the thing in the question. Offer undo instead when you can.

## Forms

- `form()` for every form, with `input`/`textarea`/`select`/`checkbox` helpers (they wire labels, hints and errors).
- Validate in the browser **and** on the server; show server field errors with the 422 shape.
- One column; labels above fields; a `hint` for format rules ("At least 8 characters"); the submit button
  says the outcome ("Create account", not "Submit").
- Keep what the person typed on error; `f.reset()` only after success.

## Interaction

- **One primary action per view** (`btn primary`); the rest `btn` or `btn ghost`.
- **Buttons say what happens:** "Save changes", "Delete order". Links go somewhere; buttons do something.
- **Keyboard:** everything clickable is a `<button>` or `<a href>`; dialogs come from `app/ui.js` (they trap and
  return focus); after navigation the router focuses `#main`. Never remove the focus outline.
- **Lists:** `repeat()` with a stable key; `class="motion"` on the container + `transition()` when items appear, move or leave; `selector()` for the
  selected row; fine-grained row signals only for big lists that change often.
- **Don't surprise:** no layout jumps when data arrives (give the loading state the data's size), no autoplay,
  no focus stealing, no scroll jumps.

## Structure

- A page is `<section>`s under one `<h1>`; each section starts with an `<h2>`.
- A component does one job, takes props as attributes, and is imported by the page that uses it.
- State only one view uses stays in that view; state pages share goes in `app/store.js`.

## Before you say done

- [ ] Every state in the table above that applies to this view exists, with words written for it
- [ ] A flow covers the main path and one unhappy path
- [ ] `npm run check` prints All good
- [ ] The pith-design review: screenshots looked at, in desktop, phone and dark
