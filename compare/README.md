# Mini vs React vs Vue

The same apps built three times, tested by the same user flows, measured the same way.
All numbers are in [RESULTS.md](RESULTS.md) (generated from `results/*.json`). This page explains how they were made and what they mean.

## What was built

| App | What it exercises | Spec |
|---|---|---|
| **Todo** (small) | state, lists, filters, localStorage | [spec/todo.md](spec/todo.md) |
| **CRM** (medium, 6 routes) | lazy routes with params, data loading with search/filter, create/edit forms with client + server validation, delete with confirm | [spec/crm.md](spec/crm.md) |
| **Bench** | js-framework-benchmark-style table: create/update/swap/remove 1,000–10,000 rows | in `bench/*` |

Each app exists as `mini/`, `react/` and `vue/`, written the way each framework's own docs recommend:
React 19 + React Router with hooks, Vue 3 + Vue Router with `<script setup>`, Mini with its built-ins.
No extra libraries: data loading and form logic for React and Vue are hand-written (a `useFetch` hook, `useState`/`reactive` forms),
because Mini has those built in. With TanStack Query, react-hook-form or VeeValidate, the React/Vue code would be shorter, at the cost of more dependencies.

A fourth variant, **Mini + Vite**, is the same Mini source bundled and minified by Vite. It shows what Mini's no-build choice costs.

**Same behavior, proven:** every implementation passes the same flows (`flows/*.js`): 8 for Todo, 11 for CRM, 1 for Bench.

## How it was measured

- **Server** (`tools/server.mjs`): gzip like a real host, over both HTTP/1.1 and HTTP/2 (HTTP/2 lets many small files load in parallel, which matters for unbundled Mini).
- **Load**: Chrome via the DevTools protocol, a fresh profile per run, Lighthouse's mobile profile (Slow 4G + 4× CPU slowdown), median of 5.
- **Runtime**: click to DOM updated and laid out, 3 warm-up + 10 measured runs with GC in between, in 3 fresh pages, median. Every operation is checked for the right result.
- **Memory**: JS heap after a forced GC.
- Mini runs with its dev warnings off, like the others' production builds.
- **Noise**: runtime numbers vary up to ±10% between sessions. Differences smaller than that are not meaningful.
  The Mini before/after table therefore compares old and new Mini **alternated in one session**, not across sessions.

## What the numbers say

**Size and loading: Mini's strongest area.**
- **JS downloaded:** Mini ships ~27 KB (gzip) for the CRM unbundled (10.4 KB with Vite), against Vue's 37 KB and React's 98 KB.
  It was ~20 KB before Mini gained layouts, guards, slots, context, error fallbacks and paginated data (October 2026);
  the extra ~7 KB cost **no measurable load time** (every Mini row moved within ±3%, the same as React's and Vue's).
- **Load speed, Mini without a build:**
  - It is ready **12–24% sooner than React** on a slow phone.
  - Over **HTTP/2** it is **5–8% slower than Vue** on every page (it was within ±4% before the new features).
  - Over **HTTP/1.1** it is **11–18% slower than Vue** on every page. Its many small files wait for the browser's ~6 parallel connections.
  - Its main cost is the import waterfall. Without bundling, the browser discovers page files level by level, and each level costs a round trip.
- **Mini + Vite is the fastest variant on every page**, ready 20–22% sooner than Vue and 39–44% sooner than React. The design is fast; skipping the build step costs some of that speed.

**Runtime: mixed, and honest.**
- **Swapping rows:** Mini is the fastest (the benchmark found a real bug that moved ~996 rows instead of 2; fixed, −87%).
- **Creating 10,000 rows:** Mini is now the fastest (588 ms vs Vue's 649 and React's 747).
- **Creating and updating rows:** Mini is still slower on the rest.
  - It creates 1,000 rows about even with React and **13% slower** than Vue.
  - Updating, replacing and appending are 6–29% slower than the fastest.
  - Selecting and removing a row are 2–3× React's time (a few ms).
  - These moved a lot since the last session (React's own "create 1,000 rows" went 49 → 56 ms), so read them as within the ±10% session noise, not as a Mini speed-up.
- **The fix had a trade-off:** it made row creation 13–24% faster, but "select" and "remove" 1–4 ms slower. That cost is kept and reported.

**Memory: Mini uses about half** of what React or Vue use (8.5 MB vs 15.7–18.3 MB with 10,000 rows), and returns to baseline after create/clear cycles.

**Code and setup:**
- **CRM size:** the CRM takes about **35% less code** in Mini (256 lines vs ~400), thanks to built-in `resource()` and `form()`.
- **Small apps:** they are about the same size in all three.
- **Dependencies:** Mini needs **0 packages and no build**. React needs 22 packages (44 MB) and Vue 67 (53 MB). Vite builds are fast (~0.2 s), so build time isn't a real cost. The setup is.

**AI-friendliness:** fresh AI agents implemented two features (a sortable table, form validation with a live counter) in each codebase.
- **Results:** **all 6 passed every hidden test on the first try**, with no regressions.
- **Mini specifically:** the model had never seen Mini and still matched React and Vue, at ~15–30% more tokens spent reading its docs.
- **Caveat:** that is one run per cell, so it's a signal, not proof.

## What it doesn't show

- **Server rendering, ecosystem, hiring, long-term maintenance:** areas where React and Vue are far ahead and benchmarks can't capture.
- **Real-device and multi-browser numbers:** all measurements are headless Chrome on one machine.
- **Large apps:** the CRM has 6 routes; behavior at 100+ routes, many developers, and years of changes is untested.

## Run it yourself

```sh
npm install            # React, Vue and Vite (Mini needs nothing)
npm run build          # Vite production builds (+ the Mini + Vite variant)
npm run flows          # same user flows against every implementation
npm run measure        # load (HTTP/1.1 + HTTP/2), runtime and memory (~15 min)
node tools/code-stats.mjs && node tools/report.mjs   # code numbers, then RESULTS.md
npm run serve -- crm react    # browse one: http://localhost:8000 (add --h2 for HTTP/2)
```
Needs Node 24+ and Chrome/Chromium. The HTTP/2 server uses a local self-signed certificate:
`openssl req -x509 -newkey rsa:2048 -nodes -keyout .cert/key.pem -out .cert/cert.pem -days 3650 -subj "/CN=localhost"`.
