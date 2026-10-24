# Changing Pith itself

For people and AI agents working on the framework (`pith/`, `tools/`, `tests/`). To build an *app* with
Pith, read [AGENTS.md](AGENTS.md) instead.

## What belongs in the core

The core keeps only what most apps need **and** is easy to get wrong without framework help: reactivity,
rendering and lists, routing, data races in loading, forms and validation, error containment. Anything an
agent can write well from the browser's own APIs (`<dialog>`, popover, View Transitions, CSS) is app code,
a pattern in the docs, or tooling. Prefer the 0-byte option: docs, a check, a warning in dev mode.

**Size budget: 10,000 bytes**, the whole of `'pith'` minified and gzipped (`tools/size.mjs`). `npm run check`
fails above it. Dev-only code (warnings, the state registry) is behind `DEV` and doesn't count.

## Where things are

| File | What it does |
|---|---|
| `pith/signal.js` | `signal`, `computed`, `effect`, `batch`, `root`, `untrack`, `onCleanup`, `catchError`, `selector` |
| `pith/html.js` | `html` templates (parsed once per call site, holes bound to their node), `repeat()` keyed lists (LIS moves) |
| `pith/component.js` | `define()` custom elements, props, slots, `provide`/`inject`, error fallback |
| `pith/router.js` | history router: lazy pages, layouts, guard, query, scroll restore, `router.ready` |
| `pith/transition.js` | `transition()`: View Transitions that can't stall |
| `pith/store.js` | `createStore()`: signals saved to localStorage, synced across tabs |
| `pith/resource.js` | `resource()`, `paginated()`, `fetchJSON()` (and the prerendered-data handover), `HttpError` |
| `pith/form.js` | `form()`, `rules`, accessible field helpers |
| `pith/dev.js` | dev mode, warning and error codes, the state registry for `see --state` |
| `pith/replay.js` | the inline script on prerendered pages (not part of `'pith'`; must stay self-contained) |
| `pith/pith.min.js` | generated: the one-file production copy. Never edit it; run `pith release` |
| `tools/` | the `pith` command (`cli.mjs`) and every tool: check, see, new, create, dev, build, prerender, release |
| `tests/` | `index.html` + `*.tests.js` (browser), `*.test.mjs` (Node), the flow harness, `a11y.js` |
| `template/` | the starter project `pith create` copies |
| `skills/` | the agent skills `pith create` copies to `.claude/skills/` (also in `../demo/.claude/skills/`) |
| `docs/errors.md` | every `W…`/`E…` code with its cause and fix |

## The loop

1. **Test first.** A browser test in `tests/index.html` or an area file (`tests/<area>.tests.js`), or a Node
   test in `tests/*.test.mjs`. Watch it fail.
2. Change the code. Match the file's style: short comments that say why, JSDoc types, no dependencies.
3. **A new warning or error** gets a code, is behind `DEV &&` (warnings), and gets an entry in `docs/errors.md`.
4. `npm run release` in `../demo` rebuilds `pith/pith.min.js` (the check fails until you do).
5. **Verify:**
   - `npm run check` here, then in `../demo`: both must print **All good**.
   - `npm run check -- --build` in `../demo` when the change touches building or prerendering.
   - `npm run check -- --browsers` (Firefox and WebKit) when it touches browser APIs.
6. **Performance-sensitive code** (`html.js` `repeat`/`place`, `signal.js`): measure before and after in one
   session with `../compare` (`node tools/ab.mjs 3`, after copying the old `pith/` to `compare/.pith-before/`).
   Keep a change only if its target gets faster and nothing else gets more than 5% slower.
7. **Docs:** the API in `README.md`. App rules in `AGENTS.md`, then copy it over the top of
   `../demo/AGENTS.md` (a test checks they match). Every new project copies `AGENTS.md`, so keep it short:
   every line costs every agent tokens. UI guidance goes in `skills/` instead (loaded only for UI work);
   copy changed skills to `../demo/.claude/skills/` too (a test checks).

## Don't

- Don't change the 6 rules in `AGENTS.md` or an export's behavior without a reason that outweighs every app
  and agent that relies on it.
- Don't add a dependency, a build step for the framework, or TypeScript files.
- Don't measure across sessions: runtime numbers vary ±10% between them. Compare in one session, in rotated order.
