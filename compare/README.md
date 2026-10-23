# Pith vs React vs Vue

The same apps built three times, tested by the same user flows, measured the same way.
Pith was called Mini until 2026-10-23; the results are the same framework.
All numbers are in [RESULTS.md](RESULTS.md) (generated from `results/*.json`). This page explains how they were made and what they mean.

## What was built

| App | What it exercises | Spec |
|---|---|---|
| **Todo** (small) | state, lists, filters, localStorage | [spec/todo.md](spec/todo.md) |
| **CRM** (medium, 6 routes) | lazy routes with params, data loading with search/filter, create/edit forms with client + server validation, delete with confirm | [spec/crm.md](spec/crm.md) |
| **Bench** | js-framework-benchmark-style table: create/update/swap/remove 1,000–10,000 rows | in `bench/*` |

Each app exists as `pith/`, `react/` and `vue/`, written the way each framework's own docs recommend:
React 19 + React Router with hooks, Vue 3 + Vue Router with `<script setup>`, Pith with its built-ins.
No extra libraries: data loading and form logic for React and Vue are hand-written (a `useFetch` hook, `useState`/`reactive` forms),
because Pith has those built in. With TanStack Query, react-hook-form or VeeValidate, the React/Vue code would be shorter, at the cost of more dependencies.

**Pith** is loaded as it's deployed without a build: the app's files as written, plus Pith's one-file production copy
(`pith.min.js`, no dev code, see `framework/tools/release.mjs`). A fourth variant, **Pith + Vite**, bundles and minifies
the app too. It shows what Pith's no-build choice costs.

**Same behavior, proven:** every implementation passes the same flows (`flows/*.js`): 8 for Todo, 11 for CRM, 1 for Bench.

## How it was measured

- **Server** (`tools/server.mjs`): gzip like a real host, over both HTTP/1.1 and HTTP/2 (HTTP/2 lets many small files load in parallel, which matters for unbundled Pith).
- **Load**: Chrome via the DevTools protocol, a fresh profile per run, Lighthouse's mobile profile (Slow 4G + 4× CPU slowdown), median of 9.
- **Runtime**: click to DOM updated and laid out, 3 warm-up + 10 measured runs with GC in between, in 3 fresh pages, median,
  over 4 rounds with the implementations in a rotated order each round (whichever runs first otherwise gets a warmer, busier machine). Every operation is checked for the right result. Each run starts right after the browser has drawn a frame, so its next frame never lands inside the timed window (before 2026-10-23 it sometimes did, which penalised Pith's remove and update by 3–7 ms).
- **Memory**: JS heap after a forced GC.
- Pith runs with its dev warnings off, like the others' production builds.
- **Noise**: runtime numbers vary up to ±10% between sessions. Differences smaller than that are not meaningful.
  The Pith before/after table therefore compares old and new Pith **alternated in one session**, not across sessions.

## What the numbers say

**Size and loading: Pith's strongest area, with or without a build.**
- **JS downloaded:** Pith ships 11 KB (gzip) for the CRM, with or without Vite, against Vue's 37 KB and React's 98 KB.
- **Pith + Vite is the fastest variant on every page**, ready 17–21% sooner than Vue and 36–42% sooner than React.
- **Pith without a build is faster than Vue too**: ready 2–19% sooner than Vue and 25–42% sooner than React, over
  both HTTP/1.1 and HTTP/2. On the one-page Todo app it ties Pith + Vite. On the CRM it's 16–21% behind Pith + Vite,
  because the app's own files load unbundled (the browser finds each lazy page's imports a round trip late).
- **Why it changed (2026-10-23):** before, no-build Pith loaded its ten readable source files, dev-only code
  (warnings, the `--state` recording) and comments included: ~30 KB, and 7–35% slower than Vue.
  `pith.min.js` is the same framework, built once and committed, so deploying still needs no build tool.
  Development keeps the sources and their warnings. `npm run check` fails if the copy falls out of date.

**Runtime: Pith leads or ties on most operations.**
- **Fastest:** selecting a row (0.3 ms vs React 1.2, Vue 2.5, thanks to `selector()`), swapping rows (5.7 ms vs
  Vue 8.5, React 47.8), removing a row (5.1 ms vs React 5.4, Vue 9.3), clearing 1,000 rows (6.5 vs Vue 7.6,
  React 9.4) and creating 10,000 rows (594 ms, level with Vue's 601; React 752).
- **Even (within 6%):** creating, replacing and appending 1,000 rows. Vue or React is a hair ahead.
- **Behind:** updating every 10th row, 19.2 ms vs React's 16.2. Pith rebuilds a row whose item is a new object;
  React patches its text.
- **Fine-grained rows close that gap (opt-in):** "Pith, fine-grained rows" (`bench/pith-fine`) is the same app with
  each row's label as a signal, so an update writes 100 labels in place. It's the fastest of all at updating
  (14.1 ms), and even with the others elsewhere. The price is memory: a signal and an effect per row, 16.1 MB at
  10,000 rows (React's level) instead of 9.2. It's the pattern for big, busy lists in `framework/README.md`
  (Lists), not the default way to write Pith, so "Pith" stays the headline number. Solid's benchmark entry
  works the same way.
- (Measured fairly since 2026-10-23: each timed run starts right after a frame. Before, the browser's next frame
  sometimes landed in the window, adding 3–7 ms to whichever framework's setup lined it up, mostly Pith's.)

**Memory: Pith uses the least**: 9.2 MB with 10,000 rows vs React's 15.7 and Vue's 18.3 (about 40% and 50% less), and returns to baseline after create/clear cycles.

**Code and setup:**
- **CRM size:** the CRM takes about **35% less code** in Pith (257 lines vs ~400), thanks to built-in `resource()` and `form()`.
- **Small apps:** they are about the same size in all three.
- **Dependencies:** Pith needs **0 packages and no build**. React needs 22 packages (44 MB) and Vue 67 (53 MB). Vite builds are fast (~0.2 s), so build time isn't a real cost. The setup is.

**AI-friendliness:** fresh AI agents implemented two features (a sortable table, form validation with a live counter) in each codebase.
- **Results:** **all 6 passed every hidden test on the first try**, with no regressions.
- **Pith specifically:** the model had never seen Pith and still matched React and Vue, at ~15–30% more tokens spent reading its docs.
- **Caveat:** that is one run per cell, so it's a signal, not proof.
- **Round 2 (after Pith's `--state` output):** a planted search bug, the same in all three CRMs, was fixed by
  every agent in 4–5 tool calls at about the same cost (Pith +4%), and re-running the old tasks on Pith showed
  no clear change from its bigger docs. The bug sat in one short file, so it was found by reading the code:
  the state output didn't get a chance to help. Setup: `tools/ai/` (plants the bug), `flows/hidden/crm-search-bug.js`.

## What it doesn't show

- **Server rendering, ecosystem, hiring, long-term maintenance:** areas where React and Vue are far ahead and benchmarks can't capture.
- **Real-device and multi-browser numbers:** all measurements are headless Chrome on one machine.
- **Large apps:** the CRM has 6 routes; behavior at 100+ routes, many developers, and years of changes is untested.

## Run it yourself

```sh
npm install            # React, Vue and Vite (Pith needs nothing)
npm run build          # Vite production builds (+ the Pith + Vite variant)
npm run flows          # same user flows against every implementation
npm run measure        # load (HTTP/1.1 + HTTP/2), runtime and memory (~15 min)
node tools/code-stats.mjs && node tools/report.mjs   # code numbers, then RESULTS.md
npm run serve -- crm react    # browse one: http://localhost:8000 (add --h2 for HTTP/2)
```
Needs Node 24+ and Chrome/Chromium. The HTTP/2 server uses a local self-signed certificate:
`openssl req -x509 -newkey rsa:2048 -nodes -keyout .cert/key.pem -out .cert/cert.pem -days 3650 -subj "/CN=localhost"`.
