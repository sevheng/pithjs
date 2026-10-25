import { html, signal, computed, batch, repeat, selector, root, untrack } from 'pith';
import { createFeed, sizeFromUrl, timer, TAPE } from '../../../shared/trade/feed.js';
import { price, percent, money, signedMoney, count, way, changePct, flashClass, arrow, sparkPoints, SPARK_W, SPARK_H } from '../../../shared/trade/format.js';
import { detail } from './detail.js';

// The trading screen: a watchlist of n symbols that tick, and the selected symbol's quote, chart, order book,
// trades and the positions. Each field that ticks is a signal, written in place in one batch() per step, so a
// tick updates the few texts and attributes that show it and nothing else is rebuilt (README, Lists: "Rows
// that change often").

const feed = createFeed({ n: sizeFromUrl() });

/** One symbol: what's fixed, and a signal for each field that ticks. @param {import('../../../shared/trade/feed.js').Instrument} s */
const toQuote = (s) => ({
  symbol: s.symbol,
  name: s.name,
  prevClose: s.prevClose,
  price: signal(s.price),
  high: signal(s.high),
  low: signal(s.low),
  volume: signal(s.volume),
  /** The last tick's direction: 1 up, -1 down, 0 none yet. */
  move: signal(0),
  /** Counts ticks, so the flash starts again on each one. */
  ticks: signal(0),
  spark: signal(s.spark),
});
/** @typedef {ReturnType<typeof toQuote>} Quote */

const quotes = feed.symbols.map(toQuote);
const selected = signal(quotes[0].symbol);
const isSelected = selector(selected); // a click re-renders the 2 rows that changed, not all n
const tape = signal(feed.trades(selected.peek()));

/** Apply one step of the feed: every tick's fields, in one batch. */
function step(/** @type {number} */ k) {
  const ticks = feed.step(k);
  batch(() => {
    const sel = selected.peek();
    for (const t of ticks) {
      const q = quotes[t.index];
      q.price.value = t.price;
      q.high.value = t.high;
      q.low.value = t.low;
      q.volume.value = t.volume;
      q.move.value = t.move;
      q.ticks.value++;
      q.spark.value = [...q.spark.peek().slice(1), t.price];
      if (t.symbol === sel) tape.value = [t.trade, ...tape.peek().slice(0, TAPE - 1)];
    }
  });
  return ticks;
}

function select(/** @type {string} */ symbol) {
  batch(() => {
    selected.value = symbol;
    tape.value = feed.trades(symbol);
  });
}

/** One watchlist row, built once per symbol. @param {Quote} q */
const row = (q) => {
  const change = computed(() => changePct(q.price.value, q.prevClose));
  return html`
    <li class=${() => (isSelected(q.symbol) ? 'wl-row selected' : 'wl-row')} data-symbol=${q.symbol}>
      <button type="button" class="wl-btn" aria-pressed=${() => String(isSelected(q.symbol))} @click=${() => select(q.symbol)}>
        <span class="wl-id"><span class="wl-sym">${q.symbol}</span><span class="wl-name">${q.name}</span></span>
        <svg class=${() => `wl-spark ${way(change.value)}`} width=${SPARK_W} height=${SPARK_H} viewBox=${`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true">
          <polyline points=${() => sparkPoints(q.spark.value)}/>
        </svg>
        <span class="wl-nums">
          <span class="wl-quote"><span class="wl-arrow" aria-hidden="true">${() => arrow(q.move.value)}</span><span class=${() => flashClass(q.move.value, q.ticks.value)}>${() => price(q.price.value)}</span></span>
          <span class=${() => `wl-change ${way(change.value)}`}>${() => percent(change.value)}</span>
        </span>
      </button>
    </li>`;
};

// ---------- Positions: live P&L, and the equity that follows all of them ----------
const positions = feed.positions.map((p) => {
  const q = quotes[p.index];
  return { ...p, q, pnl: computed(() => p.qty * (q.price.value - p.avg)) };
});
const totalPnl = computed(() => positions.reduce((sum, p) => sum + p.pnl.value, 0));
const equity = computed(() => positions.reduce((sum, p) => sum + p.qty * p.q.price.value, feed.cash));

const positionRow = (/** @type {typeof positions[number]} */ p) => html`
  <tr class="pos-row" data-symbol=${p.symbol}>
    <td>${p.symbol}</td><td>${count(p.qty)}</td><td>${price(p.avg)}</td>
    <td class="pos-last">${() => price(p.q.price.value)}</td>
    <td class=${() => `pos-pnl ${way(p.pnl.value)}`}>${() => signedMoney(p.pnl.value)}</td>
  </tr>`;

const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

root(() => {
  document.getElementById('app')?.replaceChildren(html`
    <main class="trade">
      <header class="trade-top">
        <h1>Trading</h1>
        <dl class="equity"><dt>Equity</dt><dd id="equity">${() => money(equity.value)}</dd></dl>
      </header>
      <section class="panel watch" aria-labelledby="wl-title">
        <h2 id="wl-title">Watchlist · ${count(quotes.length)} symbols</h2>
        <div class="wl-scroll">
          <ul class="wl-list" id="watchlist">${repeat(quotes, (q) => q.symbol, row)}</ul>
        </div>
      </section>
      <div class="detail">
        ${() => {
          const q = /** @type {Quote} */ (bySymbol.get(selected.value));
          return untrack(() => detail(q, feed, tape));
        }}
        <section class="panel positions" id="positions" aria-labelledby="pos-title">
          <h2 id="pos-title">Positions</h2>
          <table>
            <thead><tr><th>Symbol</th><th>Qty</th><th>Avg</th><th>Last</th><th>P&amp;L</th></tr></thead>
            <tbody>${positions.map(positionRow)}</tbody>
            <tfoot><tr><td colspan="4">Total P&amp;L</td><td id="pnl-total" class=${() => way(totalPnl.value)}>${() => signedMoney(totalPnl.value)}</td></tr></tfoot>
          </table>
        </section>
      </div>
    </main>
  `);
});

const clock = timer(step);
/** The measure script's handle (compare/trade/measure.js): the same in every implementation. */
Object.assign(window, { bench: { step, select, start: clock.start, stop: clock.stop, feed } });
