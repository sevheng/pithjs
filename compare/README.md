# Pith vs React vs Vue

The same two apps built three times, tested by the same user flows, measured the same way.
All numbers are in [RESULTS.md](RESULTS.md) (generated from `results/*.json`). This page explains how they were made and what they mean.

## What was built

| App | What it stresses | Spec |
|---|---|---|
| **Trading** | many small values changing at once: a watchlist of 40 or 1,000 prices that tick, a candlestick chart whose last candle follows the price, an order book, a trade tape, positions with live P&L | [spec/trade.md](spec/trade.md) |
| **Spreadsheet** | long chains of dependent values: 1,000 × 26 cells of formulas, a running total 1,000 cells deep, a grid drawn windowed | [spec/sheet.md](spec/sheet.md) |

Each app exists as `pith/`, `react/` and `vue/`, written the way each framework's own docs recommend:
React 19 with hooks, `useReducer`/`useMemo` and `React.memo`; Vue 3 with `<script setup>`, `shallowReactive`/`ref`
and `computed`; Pith with signals, `computed`, `repeat()` and `selector()`. No extra libraries: no state manager,
no signals library for React, no virtualization library (each app windows its own grid). What isn't framework code
is shared by all three in `shared/` (the seeded price feed, the chart geometry, the formula engine, the
formatting), so only the framework part differs. The specs say how each is written and why that's fair, including
the one real difference in design: React's spreadsheet keeps the raw text in state and evaluates every formula on
each edit, because tracking which cells an edit affects would mean writing a reactive library.

**Pith** is loaded as it's deployed without a build: the app's files as written, plus Pith's one-file production copy
(`pith.min.js`, no dev code, see `framework/tools/release.mjs`). A fourth variant, **Pith + Vite**, bundles and minifies
the app too. It shows what Pith's no-build choice costs.

**Same behavior, proven:** every implementation passes the same flows (`flows/*.js`): 5 for Trading, 5 for the
Spreadsheet. Every timed operation also checks its result in the page.

Before 2026-10-25 this folder compared a Todo app, a CRM and a js-framework-benchmark row table (and AI agents'
work on the CRM). They were replaced by these two apps, which put far more pressure on a framework's reactivity.

## How it was measured

- **Server** (`tools/server.mjs`): gzip like a real host, over both HTTP/1.1 and HTTP/2.
- **Load**: Chrome via the DevTools protocol, a fresh profile per run, Lighthouse's mobile profile (Slow 4G + 4× CPU slowdown), median of 9.
- **Runtime**: from the call (a click, or the app's `window.bench` handle) to the DOM updated and laid out, 3 warm-up
  + 10 measured runs with GC in between, in 3 fresh pages, median, over 4 rounds with the implementations in a
  rotated order each round. Each run starts right after the browser has drawn a frame. Where a framework renders
  after a task (React from outside its own events), the measurement waits until the DOM shows the result, the same
  way for all.
- **Under load**: 5 seconds of ticks or edits on a timer, every frame recorded (frames per second, median and
  95th-percentile frame time, long tasks), one run per round.
- **Memory**: JS heap after a forced GC.
- Pith runs with its dev warnings off, like the others' production builds.
- **Noise**: runtime numbers vary up to ±10% between sessions. Differences smaller than that are not meaningful.
  Changes to Pith itself are compared **alternated in one session** with `tools/ab.mjs` (old `pith/` copied to
  `.pith-before/`), not across sessions.

Each app's `measure.js` names what's measured; `tools/measure.mjs` times them all the same way.
`node tools/measure.mjs [load] [runtime] [stress] [memory] [--app trade]`, then `node tools/report.mjs`.
`tools/profile.mjs` prints where the time of one operation goes.

## What the numbers say

**Loading: Pith's strongest area.**
- **JS downloaded:** Trading needs 20 KB (gzip) in Pith without a build, app and shared code included, and 9.6 KB
  bundled, against Vue's 29 KB and React's 71 KB.
- **Pith + Vite is the fastest on every page**: ready 18–21% sooner than Vue and 38–40% sooner than React.
- **Pith without a build is level with Vue** (from 5% behind to 11% ahead, depending on the app and protocol) and
  19–31% sooner than React. It's 12–32% behind Pith + Vite, because the browser fetches the app's own files one by
  one instead of one bundle.

**Trading: Pith is fastest at every update, and uses the least memory.**
- **Few prices ticking in a long list** (10 of 1,000): Pith updates the page in 3.3 ms, Vue in 3.9, React in 7.4.
  Pith and Vue write the changed values in place; React re-renders the changed rows and compares the rest.
- **A full step of 40 prices:** Pith 9.2 ms, React 10.3, Vue 10.9. **All 1,000 at once:** Pith 223 ms, Vue 284, React
  331 (most of it is the browser's style and layout, and the 1,000 restarted flash animations).
- **Switching symbol:** all within 3% (React 7.8, Vue 7.9, Pith 8.0 ms).
- **Memory:** 5.1 MB for 1,000 symbols, against React's 5.6 and Vue's 8.2; after 2,000 steps Pith is at 5.7, React at
  10.1, Vue at 8.9.
- **Under load** (1,000 symbols at 60 steps a second): all four draw the same, about 27 frames a second with 40
  prices per step and about 5 with all 1,000. The browser's layout of the 1,000-row list is the limit, not the
  framework.

**Spreadsheet: Pith is fastest at every edit; React at bulk changes.**
- **Editing the top of a 1,000-deep chain:** Pith 3.5 ms, Vue 4.6, React 5.4.
- **An edit nobody else reads:** Pith 0.9 ms, Vue 1.8, React 5.4. Only what depends on the edit is worked out;
  React evaluates every formula again.
- **Scrolling one screen:** Pith 6.3 ms, Vue 6.5, React 6.8.
- **Fill and clear 5,000 cells:** React is fastest (31 ms and 4.0), because it stores text and builds no reactive
  values. Pith takes 37 and 10.6, Vue 34 and 77.
- **Memory:** Pith and Vue 5.1 MB, React 3.1 (plain text costs less than a reactive value per cell).
- **Under load** (100 random edits a second): all four hold 60 frames a second.

**How Pith got here (2026-10-25).** This benchmark found Pith behind and its core was changed, each step A/B
tested in one session (`results/ab-*.json`):
1. Computeds nobody reads skip their updates; a flush finds the next level without a scan; effects keep their
   subscriptions across runs (`ab-signals.json`: fill −20%, Edit A1 −31%, clear −31%). Before this, a chain of
   1,000 computeds failed outright with E003.
2. Signals, computeds and effects became classes with their parts made on first use, instead of objects full of
   closures (`ab-classes.json`: Edit A1 −48%, clear −41%, fill −21%, ticking rows −14%). A signal went from 720 to
   48 bytes; Trading's memory from 8.4 to 5.1 MB, the spreadsheet's from 11.3 to 5.1.

**Code and setup:**
- **Code size:** Trading takes 207 lines in Pith, 245 in React and 247 in Vue; the Spreadsheet 227, 188 and 227
  (React's is shortest because it doesn't track dependencies at all).
- **Dependencies:** Pith needs **0 packages and no build**. React needs 19 packages (41 MB) and Vue 35 (49 MB).
  Vite builds are fast (~0.3 s), so build time isn't a real cost. The setup is.

**Not measured:** routing, data loading, forms, server rendering, the ecosystem, hiring and years of maintenance,
where React and Vue are far ahead.
