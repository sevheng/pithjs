# Changelog

## 0.1.1 (2026-10-25)

- A trailing slash is the same page: `/docs/signals/` (how GitHub Pages and other static hosts serve a prerendered
  page's folder) is `router.path` `/docs/signals`, so links marked as current and layouts match on first load.
- E003 keeps its full message in development only, like E001, E002, E004 and E005.
- The frosted bars keep their blur in production: the starter CSS writes `-webkit-backdrop-filter` before
  `backdrop-filter` (the build's CSS minifier kept only the prefixed one, which Chrome ignores).
- A page change no longer shows an empty frame: the new page starts partly visible and settles in.

## 0.1.0 (2026-10-25)

The first release. Pith is an experiment: its API may still change.

- **The core, ~10 KB gzipped, no dependencies:** signals, computeds and effects (updates in order, once each;
  computeds nobody reads skip their work), `html` and `svg` templates, keyed `repeat()` and `selector()`,
  components (`define`, slots, `provide`/`inject`, error fallbacks), a router (lazy pages, layouts, guards,
  `?query`, scroll restoring, View Transitions), `resource()` / `paginated()` with optimistic updates,
  `form()` with rules and server errors, `createStore()` saved and synced across tabs, `transition()` and
  `class="motion"`.
- **No build step needed:** files run as written. `pith/pith.min.js` is the one-file production copy for a
  site deployed without a build.
- **Tools (`pith ...`):** `create`, `dev` (Vite), `serve` (no build), `build` (bundled and prerendered, with
  `--base /repo/` for a site served from a folder), `preview`, `check` (tests, user flows, every route at phone
  width, accessibility in both themes, types, size), `see` (a page as text and a screenshot), `new`.
- **For AI agents:** every project gets `AGENTS.md` and two skills (`pith-frontend`, `pith-design`); every
  warning and error has a code and a fix in `docs/errors.md`.
- **Measured** against React and Vue on a trading screen and a spreadsheet: see `compare/RESULTS.md` in the repo.
