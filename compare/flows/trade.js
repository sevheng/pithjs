// Correctness checks for the Trading app: every implementation must show exactly the same thing. The feed only
// moves through window.bench (as the measurements drive it), and every expected value comes from the shared
// feed and helpers, so a check doesn't depend on the framework.
import { flow } from 'pith/testing';
import { price, percent, money, signedMoney, changePct, sparkPoints } from '/shared/trade/format.js';
import { extent, rangeKey, scale, candleShape } from '/shared/trade/chart.js';

const rows = (app) => app.queryAll('#watchlist .wl-row');
const rowOf = (app, symbol) => app.query(`#watchlist .wl-row[data-symbol="${symbol}"]`);
const text = (el, sel) => el?.querySelector(sel)?.textContent;
const bench = (app) => app.window.bench;

/** The DOM shows `symbol` as the selected one: its row, quote, chart, book and tape. */
function showsSelected(app, symbol) {
  const feed = bench(app).feed;
  const live = feed.price(symbol);
  const candles = feed.candles(symbol);
  const s = scale(rangeKey(extent(candles), live), candles.length);
  const tape = feed.trades(symbol);
  const tapeRows = app.queryAll('#tape .tape-list .tape-row');
  const best = feed.book(symbol, live).bids[0];
  return text(app.document, '#quote .q-sym') === symbol
    && text(app.document, '#quote .q-price') === price(live)
    && app.query('#chart svg')?.getAttribute('aria-label')?.startsWith(`${symbol},`)
    && app.queryAll('#chart .cdl').length === 120
    && app.query('#chart .cdl .cdl-wick')?.getAttribute('d') === candleShape(candles[0], 0, s).wick
    && text(app.document, '#chart .last-text') === price(live)
    && app.queryAll('#book .book-row.ask').length === 10 && app.queryAll('#book .book-row.bid').length === 10
    && text(app.document, '#book .book-row.bid.best .book-price') === price(best.price)
    && tapeRows.length === 30 && text(tapeRows[0], '.tape-time') === tape[0].time && text(tapeRows[0], '.tape-price') === price(tape[0].price)
    && rowOf(app, symbol)?.classList.contains('selected');
}

flow('ticks change prices, and the change and spark follow', async (app) => {
  await app.go('/');
  app.expect(text(app.document, '#wl-title') === 'Watchlist · 40 symbols', 'the watchlist should say how many symbols it has');
  const feed = bench(app).feed;
  const first = feed.symbols[2];
  const row = rowOf(app, first.symbol);
  app.expect(text(row, '.wl-price') === price(first.price), 'a row should start at its feed price');
  app.expect(text(row, '.wl-arrow') === '', 'no arrow before the first tick');
  const ticks = bench(app).step(40);
  const t = ticks.find((x) => x.symbol === first.symbol);
  await app.waitFor(() => text(row, '.wl-price') === price(t.price), `${first.symbol} should show its new price ${price(t.price)}`);
  app.expect(text(row, '.wl-change') === percent(changePct(t.price, first.prevClose)), 'the change in % should follow the price');
  app.expect(row.querySelector('.wl-change').classList.contains(changePct(t.price, first.prevClose) > 0 ? 'up' : 'down'), 'the change should be colored up or down');
  app.expect(row.querySelector('.wl-price').classList.contains(`flash-${t.move > 0 ? 'up' : 'down'}-1`), 'the price should flash in its direction');
  app.expect(text(row, '.wl-arrow') === (t.move > 0 ? '▲' : '▼'), 'the arrow should show the direction');
  const points = sparkPoints([...first.spark.slice(1), t.price]);
  app.expect(row.querySelector('.wl-spark polyline').getAttribute('points') === points, 'the sparkline should end at the new price');

  // Each step's ticks reach their rows; a second step flashes again (the other class name).
  const again = bench(app).step(40).find((x) => x.symbol === first.symbol);
  await app.waitFor(() => text(row, '.wl-price') === price(again.price), 'a second tick should show too');
  app.expect(row.querySelector('.wl-price').classList.contains(`flash-${again.move > 0 ? 'up' : 'down'}-0`), 'a second tick should restart the flash');
  app.expect(rows(app).every((r) => text(r, '.wl-price') === price(feed.price(r.dataset.symbol))), 'every row should show its feed price');
});

flow('clicking a row selects it, and the chart, book, tape and quote switch', async (app) => {
  await app.go('/');
  const feed = bench(app).feed;
  await app.waitFor(() => showsSelected(app, feed.symbols[0].symbol), 'the first symbol should start selected');
  const target = feed.symbols[4].symbol;
  await app.click(`#watchlist .wl-row[data-symbol="${target}"] .wl-btn`);
  await app.waitFor(() => showsSelected(app, target), `clicking ${target} should show its quote, chart, book and tape`);
  // While selected, its ticks reach the quote, the chart's last price, the book and the tape (one row at the top).
  const t = bench(app).step(40).find((x) => x.symbol === target);
  await app.waitFor(() => text(app.document, '#quote .q-price') === price(t.price), 'the quote should follow the price');
  await app.waitFor(() => showsSelected(app, target), 'the chart, book and tape should follow the price');
  const tapeRows = app.queryAll('#tape .tape-list .tape-row');
  app.expect(text(tapeRows[0], '.tape-time') === t.trade.time && text(tapeRows[0], '.tape-size') === t.trade.size.toLocaleString('en-US'), 'the new trade should be at the top of the tape');
  app.expect(text(app.document, '#quote .q-high') === price(t.high) && text(app.document, '#quote .q-low') === price(t.low), 'high and low should follow');
});

flow('P&L and equity follow the price', async (app) => {
  await app.go('/');
  const feed = bench(app).feed;
  const shown = () => {
    let equity = feed.cash;
    let total = 0;
    for (const p of feed.positions) {
      const live = feed.price(p.symbol);
      const pnl = p.qty * (live - p.avg);
      equity += p.qty * live;
      total += pnl;
      const row = app.query(`#positions .pos-row[data-symbol="${p.symbol}"]`);
      if (text(row, '.pos-last') !== price(live) || text(row, '.pos-pnl') !== signedMoney(pnl)) return false;
    }
    return text(app.document, '#equity') === money(equity) && text(app.document, '#pnl-total') === signedMoney(total);
  };
  app.expect(app.queryAll('#positions .pos-row').length === 5, 'there should be 5 positions');
  await app.waitFor(shown, 'the positions should show their P&L at the start');
  const before = text(app.document, '#equity');
  for (let i = 0; i < 3; i++) {
    bench(app).step(40);
    await app.waitFor(shown, `after step ${i + 1}, each P&L and the equity should follow the prices`);
  }
  app.expect(text(app.document, '#equity') !== before, 'the equity should have moved');
});

flow('?n=1000 shows 1,000 rows, and a small step changes only its rows', async (app) => {
  await app.go('/?n=1000');
  app.expect(text(app.document, '#wl-title') === 'Watchlist · 1,000 symbols', 'the watchlist should say it has 1,000 symbols');
  app.expect(rows(app).length === 1000, 'all 1,000 rows should be in the DOM');
  const feed = bench(app).feed;
  const ticks = bench(app).step(10);
  const last = ticks[ticks.length - 1];
  await app.waitFor(() => text(rowOf(app, last.symbol), '.wl-price') === price(last.price), 'the ticked rows should show their new prices');
  app.expect(ticks.every((t) => text(rowOf(app, t.symbol), '.wl-price') === price(t.price)), 'every ticked row should show its new price');
  const untouched = rows(app).slice(10).filter((r) => r.querySelector('.wl-price').className !== 'wl-price');
  app.expect(untouched.length === 0, 'rows that did not tick should not flash');
  // The next steps move on to the next symbols: all of them tick over 100 steps.
  for (let i = 0; i < 99; i++) bench(app).step(10);
  await app.waitFor(() => rows(app).every((r) => r.querySelector('.wl-price').className !== 'wl-price'), 'every symbol should have ticked after 100 steps of 10');
  app.expect(rows(app).every((r) => text(r, '.wl-price') === price(feed.price(r.dataset.symbol))), 'every row should show its feed price');
});

flow('selection marks exactly one row', async (app) => {
  await app.go('/');
  const selected = () => app.queryAll('#watchlist .wl-row.selected');
  const pressed = () => app.queryAll('#watchlist .wl-btn[aria-pressed="true"]');
  app.expect(selected().length === 1 && pressed().length === 1, 'one row should start selected');
  for (const i of [7, 3, 7, 39]) {
    const symbol = bench(app).feed.symbols[i].symbol;
    await app.click(`#watchlist .wl-row[data-symbol="${symbol}"] .wl-btn`);
    await app.waitFor(() => selected().length === 1 && selected()[0].dataset.symbol === symbol && pressed().length === 1
      && pressed()[0].closest('.wl-row') === selected()[0], `only ${symbol} should be selected`);
  }
});
