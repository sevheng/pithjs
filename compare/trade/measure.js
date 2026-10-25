// What tools/measure.mjs measures in the Trading app (the contract is at the top of measure.mjs). Every check reads
// the DOM and compares it with the shared feed (window.bench.feed), so an implementation that skipped or delayed
// work fails instead of looking fast.

// Present once the watchlist rows and the chart are on screen (they arrive in the same render everywhere).
const READY = 'main.trade:has(#watchlist .wl-row):has(#chart .cdl.last)';

// In the page: wait for the app, and the checks every operation shares.
const prelude = (n) => `
  await __m.waitFor(() => window.bench && document.querySelectorAll('#watchlist .wl-row').length === ${n} && document.querySelector(${JSON.stringify(READY)}));
  const feed = window.bench.feed;
  const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const price = (x) => two.format(x);
  const money = (x) => '$' + two.format(x);
  const text = (sel, root = document) => root.querySelector(sel)?.textContent;
  const rowOf = (symbol) => document.querySelector('#watchlist .wl-row[data-symbol="' + symbol + '"]');
  const equity = () => money(feed.positions.reduce((s, p) => s + p.qty * feed.price(p.symbol), feed.cash));
  // After a step: every ticked row shows its new price and flashes, the selected symbol's quote and the equity follow.
  let ticks = [];
  const stepped = () => {
    if (!ticks.length) return false;
    for (const t of ticks) {
      const row = rowOf(t.symbol);
      if (text('.wl-price', row) !== price(t.price)) return false;
      if (!row.querySelector('.wl-price').className.includes(t.move > 0 ? 'flash-up' : 'flash-down')) return false;
    }
    const sel = text('#quote .q-sym');
    return text('#quote .q-price') === price(feed.price(sel)) && text('#chart .last-text') === price(feed.price(sel))
      && text('#equity') === equity();
  };
  // run() returns once the DOM shows the change. Pith updates it in the call, Vue in a microtask, React in a task
  // it schedules (an update from outside a React event): each check is one cheap read, then one more macrotask
  // until it holds. The same code for every implementation; ok() then checks everything.
  const until = async (check) => { while (!check()) await __m.tick(); };
  const lastShown = () => { const t = ticks[ticks.length - 1]; return text('.wl-price', rowOf(t.symbol)) === price(t.price); };
  const step = (k) => ({ run: () => { ticks = window.bench.step(k); return until(lastShown); }, ok: stepped });
`;

const runtime40 = `(async () => {
  ${prelude(40)}
  const chart = await import('/shared/trade/chart.js');
  let i = 0;
  let target = '';
  // After a switch: the selected row, quote, chart, book and tape are all the new symbol's.
  const switched = () => {
    const live = feed.price(target);
    const rows = document.querySelectorAll('#watchlist .wl-row.selected');
    if (rows.length !== 1 || rows[0].dataset.symbol !== target) return false;
    if (text('#quote .q-sym') !== target || text('#quote .q-price') !== price(live)) return false;
    const candles = feed.candles(target);
    const s = chart.scale(chart.rangeKey(chart.extent(candles), live), candles.length);
    const first = document.querySelector('#chart .cdl .cdl-wick');
    if (document.querySelectorAll('#chart .cdl').length !== 120 || first?.getAttribute('d') !== chart.candleShape(candles[0], 0, s).wick) return false;
    if (text('#chart .last-text') !== price(live)) return false;
    const best = feed.book(target, live).bids[0];
    if (text('#book .book-row.bid.best .book-price') !== price(best.price)) return false;
    const tape = feed.trades(target);
    const rowsTape = document.querySelectorAll('#tape .tape-list .tape-row');
    return rowsTape.length === 30 && text('.tape-time', rowsTape[0]) === tape[0].time && text('.tape-price', rowsTape[0]) === price(tape[0].price);
  };
  return __m.ops({
    'step: 40 of 40 symbols': step(40),
    'switch symbol': {
      setup: () => { target = feed.symbols[1 + (i++ % 20)].symbol; },
      run: () => { window.bench.select(target); return until(() => text('#quote .q-sym') === target); },
      ok: switched,
    },
  });
})()`;

const runtime1000 = `(async () => {
  ${prelude(1000)}
  return __m.ops({
    'step: 1,000 of 1,000 symbols': step(1000),
    'step: 10 of 1,000 symbols': step(10),
  });
})()`;

export const load = { path: '/', ready: READY };

export const runtime = [
  { path: '/?n=40', script: runtime40 },
  { path: '/?n=1000', script: runtime1000 },
];

export const stress = [
  {
    name: '1,000 symbols, 60 steps/s',
    path: '/?n=1000',
    script: `(async () => {
      ${prelude(1000)}
      return __m.underLoad(() => window.bench.start(60, 1000), () => window.bench.stop(), 5000);
    })()`,
  },
];

export const memory = [
  { name: '40 symbols', path: '/?n=40', script: `(async () => { ${prelude(40)} })()` },
  { name: '1,000 symbols', path: '/?n=1000', script: `(async () => { ${prelude(1000)} })()` },
  {
    // 2,000 steps of 100 symbols (each symbol ticks 200 times, the tape turns over many times), each one
    // rendered (a macrotask between steps), then a second to settle.
    name: '1,000 symbols after 2,000 steps',
    path: '/?n=1000',
    script: `(async () => {
      ${prelude(1000)}
      for (let i = 0; i < 2000; i++) { ticks = window.bench.step(100); await __m.tick(); }
      await __m.settle();
      await new Promise((r) => setTimeout(r, 1000));
      if (!stepped()) throw new Error('after 2,000 steps: wrong result');
    })()`,
  },
];
