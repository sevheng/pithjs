# Stress app: Trading

One screen of a trading terminal: a watchlist of `n` symbols whose prices tick, and the selected symbol's quote,
candlestick chart, order book, trade tape and positions. It measures what a framework costs when **many small
values change at once**. No router, no API, no timers of its own: the measure script and the flows drive the
market through `window.bench`, so every run and every implementation sees exactly the same values.

Implementations: `trade/pith/` (no build), `trade/react/` (React 19, Vite), `trade/vue/` (Vue 3, Vite) and
`pith-vite` (the Pith source bundled by Vite). Flows: `flows/trade.js`. Measurements: `trade/measure.js`.

## Shared code (`shared/trade/`)

Everything that isn't the framework is shared, imported by relative path (`../../../shared/trade/feed.js`):
served as `/shared/...` to Pith, bundled by Vite for the others.

| File | What |
|---|---|
| `feed.js` | The market: `createFeed({ n, seed })`, a seeded random walk (mulberry32). Plain JavaScript, no framework |
| `format.js` | Number formats (`price`, `percent`, `money`, `signedMoney`, `count`, `way`), `changePct`, `flashClass`, `arrow`, `sparkPoints` |
| `chart.js` | The chart's geometry: `extent`, `lastCandle`, `rangeKey`, `scale`, `candleShape`, `priceLine` |
| `styles.css` | The screen's CSS, on top of `/styles.css` and its tokens |

`createFeed({ n = 40, seed = 7 })` returns:
- `symbols`: `n` made-up symbols `{ symbol, index, name, prevClose, price, high, low, volume, spark }` (`spark`: 20
  points ending at `price`).
- `positions`: 5 `{ symbol, index, qty, avg }` (symbols 0, 3, 7, 12 and 21), and `cash` (25,000).
- `step(k)`: one market step. The **next** `k` symbols after the previous step's tick (wrapping around), so steps of
  10 over 1,000 symbols reach every symbol in 100 steps. Returns the ticks
  `[{ symbol, index, price, move: 1 | -1, high, low, volume, trade: { id, price, size, side, time } }]`.
- `candles(symbol)`: 120 one-minute candles `{ t, o, h, l, c }`, oldest first, the last closing at the symbol's
  starting price (the same array on every call).
- `book(symbol, price)`: `{ asks, bids }`, 10 levels each `{ price, size, total, depth }`, in display order (asks from
  the highest down, then bids from the price down). Sizes depend only on symbol and price.
- `trades(symbol)`: the symbol's last 30 trades, newest first. The first call makes a seeded history; from then on
  each tick of that symbol puts its trade on top (a new array each time).
- `price(symbol)`, `indexOf(symbol)`; and `sizeFromUrl()` (`?n=`, default 40) and `timer(step)` (`start`/`stop`).

## What each implementation does

State: per symbol its price, high, low, volume, last move (1/-1/0), tick count and 20-point spark; the selected
symbol (the first one at the start); the selected symbol's tape (`feed.trades(selected)` at selection).

**A step** (`bench.step(k)`): `ticks = feed.step(k)`, then for each tick: set price, high, low, volume, move,
`ticks + 1`, and `spark = [...spark.slice(1), price]`; if it's the selected symbol, `tape = [trade, ...tape.slice(0, 29)]`.
Returns `ticks`. **Select** (`bench.select(symbol)` or a click on a row): selected = symbol, tape = `feed.trades(symbol)`.

Derived: change % = `changePct(price, prevClose)`; P&L = `qty × (price − avg)`; total P&L; equity = `cash + Σ qty × price`.

## DOM contract (the same classes and ids in all three)

```
<main class="trade">
  <header class="trade-top"><h1>Trading</h1>
    <dl class="equity"><dt>Equity</dt><dd id="equity">{money(equity)}</dd></dl></header>
  <section class="panel watch"><h2 id="wl-title">Watchlist · {count(n)} symbols</h2>
    <div class="wl-scroll"><ul class="wl-list" id="watchlist">            all n rows, in feed order, not windowed
      <li class="wl-row[ selected]" data-symbol="{symbol}">
        <button type="button" class="wl-btn" aria-pressed="{true|false}">
          <span class="wl-id"><span class="wl-sym">{symbol}</span><span class="wl-name">{name}</span></span>
          <svg class="wl-spark {way(change)}" width="64" height="22" viewBox="0 0 64 22" aria-hidden="true">
            <polyline points="{sparkPoints(spark)}"/></svg>
          <span class="wl-nums">
            <span class="wl-quote"><span class="wl-arrow" aria-hidden="true">{arrow(move)}</span>
              <span class="{flashClass(move, ticks)}">{price}</span></span>         wl-price[ flash-{up|down}-{ticks % 2}]
            <span class="wl-change {way(change)}">{percent(change)}</span></span></button></li>
  <div class="detail">
    <section class="panel quote" id="quote">  .q-sym (h2) .q-name .q-price .q-change.{way}  dl.q-range: .q-high .q-low .q-vol
    <section class="panel chart" id="chart">
      <svg viewBox="0 0 640 240" role="img" aria-label="{symbol}, 120 one-minute candles">
        grid: path.chart-grid + text.chart-tick per round price in the y range
        119 × <g class="cdl {up|down}"><path class="cdl-wick" d/><rect class="cdl-body" x y width height/></g>
        <g class="cdl {up|down} last">…</g>                         the last candle: closes at the live price
        <g class="last-price {way}"><path class="last-line"/><rect class="last-tag"/><text class="last-text">{price}</text></g>
    <div class="panels">
      <section class="panel book" id="book">  ul.book-list: 10 × li.book-row.ask, then 10 × li.book-row.bid (the first also .best),
          each style="--depth: {depth×100, 1 decimal}%" with .book-price .book-size .book-total
      <section class="panel tape" id="tape">  ul.tape-list: 30 × li.tape-row (keyed by trade id) with
          .tape-time, .tape-price.{up|down} (buy: up), .tape-size
    <section class="panel positions" id="positions">  table: thead; tbody 5 × tr.pos-row[data-symbol] with
          symbol, qty, avg, td.pos-last, td.pos-pnl.{way}; tfoot td#pnl-total.{way}
```
The chart's shapes come from `shared/trade/chart.js`: the y range is a string key in round steps (`rangeKey`), so it
changes only when the live price leaves it; the 119 fixed candles are drawn again only then. On other ticks only the
last candle and the price line change.

## `window.bench`
`{ step(k), select(symbol), start(stepsPerSecond, k), stop(), feed }`, set once the app has started.
- `step(k)` applies one feed step through the framework's normal update and returns the ticks.
- `select(symbol)` is what a click on the row does.
- `start`/`stop` run `step(k)` on a `setInterval` (`shared/trade/feed.js` `timer()`, the same for all).
- `feed` is the shared feed, for checks.

## How each one is written, and why it's fair

Each is written the way its own docs recommend for a list whose rows change often, with no extra libraries.

- **Pith** (`trade/pith/app/`): a signal per field that ticks (price, high, low, volume, move, ticks, spark), the
  rows in `repeat(quotes, q => q.symbol, row)`, the selected row through `selector(selected)`, `computed()` for each
  row's change and each position's P&L, equity and total. A step writes the ticks in one `batch()`, so each changed
  text and attribute updates once, synchronously. The detail is a function hole on `selected`, built again on a switch.
  This is the demo's Trading pattern (README, Lists: "Rows that change often").
- **React 19** (`trade/react/src/App.jsx`): one `useReducer` holds quotes, selection and tape. A step is one
  `dispatch`; the reducer copies the quotes array and replaces only the ticked quotes' objects (the others keep their
  identity). Rows are `React.memo` with `key={symbol}`, so only ticked rows (and the two whose selection changed)
  render; the chart's 119 fixed candles are a memoized component keyed on the y range; book and positions are memo
  components with `useMemo` for the book. React's automatic batching and scheduling are left as they are: no
  `flushSync`. Production build, `StrictMode` (no effect in production).
- **Vue 3** (`trade/vue/src/`): `<script setup>` SFCs and a small store module (`store.js`, Vue's "state management
  with the Reactivity API"). Each quote is a `shallowReactive` object mutated in place; arrays that change (spark,
  tape) are replaced. Each row is its own component (`WatchRow.vue`, `computed` change and points), so a tick renders
  only the rows that read what changed; the fixed candles are their own component (`CandleSet.vue`). A step mutates,
  and Vue's scheduler updates the DOM in a microtask. `v-for` with `:key` everywhere.

**Timing.** `__m.ops` times from `run()` to the DOM updated and laid out. The three update the DOM at different
moments: Pith inside `step()`, Vue in a microtask, React 19 in a task its scheduler queues (an update from outside a
React event is not synchronous; its task is queued from a microtask, so it lands after a message posted during
`run()`). So each `run()` (in `trade/measure.js`) returns a promise that checks one thing cheaply (the last ticked
row's price, or the quote's symbol after a switch) and waits one more macrotask (`__m.tick()`) until it holds. The
same code runs for all three; Pith passes the first check at once, Vue after one tick, React after two. Then `ok()`
checks everything: every ticked row's price and flash, the quote, the chart's last price and the equity (and after a
switch, the selected row, the chart's first candle, the book's best bid and the tape), against the shared feed.

**Under load** (`bench.start(60, 1000)`): steps come from a timer. React may fold several queued updates into one
render when it falls behind (its scheduler's normal behavior); Pith and Vue apply every step. That is what each
does in a real app, so it's measured as is: frames per second, frame times and long tasks.

## Measurements (`trade/measure.js`)
- **load**: `/`, ready when `main.trade:has(#watchlist .wl-row):has(#chart .cdl.last)`.
- **runtime**: `/?n=40`: `step: 40 of 40 symbols`, `switch symbol` (another symbol each time); `/?n=1000`:
  `step: 1,000 of 1,000 symbols`, `step: 10 of 1,000 symbols` (does the cost follow what changed or the list size?).
- **stress**: `1,000 symbols, 60 steps/s` for 5 s.
- **memory**: `40 symbols`, `1,000 symbols`, and `1,000 symbols after 2,000 steps` (steps of 100, a macrotask
  between steps so each renders, then a second to settle).
