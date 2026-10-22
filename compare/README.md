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
- **Runtime**: click to DOM updated and laid out, 3 warm-up + 10 measured runs with GC in between, in 3 fresh pages, median. Every operation is checked for the right result. Each run starts right after the browser has drawn a frame, so its next frame never lands inside the timed window (before 2026-10-23 it sometimes did, which penalised Mini's remove and update by 3–7 ms).
- **Memory**: JS heap after a forced GC.
- Mini runs with its dev warnings off, like the others' production builds.
- **Noise**: runtime numbers vary up to ±10% between sessions. Differences smaller than that are not meaningful.
  The Mini before/after table therefore compares old and new Mini **alternated in one session**, not across sessions.

## What the numbers say

**Size and loading: Mini's strongest area once built.**
- **JS downloaded:** Mini ships 11 KB (gzip) for the CRM with Vite, against Vue's 37 KB and React's 98 KB.
  Unbundled it ships ~30 KB: without a build the browser also downloads Mini's dev-only code (warnings,
  the `--state` recording) and comments, which a build strips. That grew from ~20 KB to ~30 KB in October 2026.
- **Mini + Vite is the fastest variant on every page**, ready 19–23% sooner than Vue and 38–45% sooner than React.
- **Load speed, Mini without a build:**
  - It is ready **4–22% sooner than React** on a slow phone (4–7% over HTTP/1.1, 15–22% over HTTP/2).
  - Over **HTTP/2** it is **7–11% slower than Vue**; over **HTTP/1.1**, **21–35% slower**.
  - Its costs are the import waterfall (the browser discovers files level by level, a round trip each), its
    many small files waiting for HTTP/1.1's ~6 connections, and the dev-only code it can't strip.
  - The extra dev code of October 2026 made it 7–14% slower over HTTP/1.1 (1–3% over HTTP/2). Use a build in production.

**Runtime: Mini leads or ties on most operations.** (Measured fairly since 2026-10-23: each timed run starts
right after a frame. Before, the browser's next frame sometimes landed in the window, adding 3–7 ms to
whichever framework's setup lined it up, mostly Mini's remove and update.)
- **Fastest:** selecting a row (0.3 ms vs React 1.3, Vue 2.4, thanks to `selector()`), swapping rows (5 ms vs
  Vue 7.5, React 42.4), removing a row (4.0 ms vs React 4.3, Vue 7.9) and clearing 1,000 rows.
- **Even (within 3%):** creating and replacing 1,000 rows (Vue a hair ahead).
- **Behind:** updating every 10th row (17.6 ms vs React's 13.0: Mini rebuilds a row whose item changed, React
  patches its text), appending 1,000 rows and creating 10,000 (Vue fastest, 6–8% ahead).
- **Trade-off kept:** `selector()` adds a little to clearing (each row's entry is released); Mini is still the
  fastest at clearing.

**Memory: Mini uses the least**: 9.2 MB with 10,000 rows vs React's 15.7 and Vue's 18.3 (about 40% and 50% less), and returns to baseline after create/clear cycles.

**Code and setup:**
- **CRM size:** the CRM takes about **35% less code** in Mini (256 lines vs ~400), thanks to built-in `resource()` and `form()`.
- **Small apps:** they are about the same size in all three.
- **Dependencies:** Mini needs **0 packages and no build**. React needs 22 packages (44 MB) and Vue 67 (53 MB). Vite builds are fast (~0.2 s), so build time isn't a real cost. The setup is.

**AI-friendliness:** fresh AI agents implemented two features (a sortable table, form validation with a live counter) in each codebase.
- **Results:** **all 6 passed every hidden test on the first try**, with no regressions.
- **Mini specifically:** the model had never seen Mini and still matched React and Vue, at ~15–30% more tokens spent reading its docs.
- **Caveat:** that is one run per cell, so it's a signal, not proof.
- **Round 2 (after Mini's `--state` output):** a planted search bug, the same in all three CRMs, was fixed by
  every agent in 4–5 tool calls at about the same cost (Mini +4%), and re-running the old tasks on Mini showed
  no clear change from its bigger docs. The bug sat in one short file, so it was found by reading the code:
  the state output didn't get a chance to help. Setup: `tools/ai/` (plants the bug), `flows/hidden/crm-search-bug.js`.

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
