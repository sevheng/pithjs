import { html, svg, computed, repeat } from 'pith';
import { price, percent, count, way, changePct } from '../../../shared/trade/format.js';
import { W, H, RIGHT, extent, lastCandle, rangeKey, scale, candleShape, priceLine } from '../../../shared/trade/chart.js';

/** @typedef {import('./main.js').Quote} Quote */
/** @typedef {import('../../../shared/trade/feed.js').Feed} Feed */
/** @typedef {import('../../../shared/trade/feed.js').Trade} Trade */

/**
 * The selected symbol: quote, chart, order book and trades. Built again when another symbol is selected; while
 * it's on screen, a tick only updates the texts and attributes that read the symbol's signals.
 * @param {Quote} q @param {Feed} feed @param {import('pith').ReadonlySignal<Trade[]>} tape
 */
export function detail(q, feed, tape) {
  const pct = computed(() => changePct(q.price.value, q.prevClose));
  return html`
    <section class="panel quote" id="quote" aria-label="Quote">
      <h2 class="q-sym">${q.symbol}</h2>
      <p class="q-name">${q.name}</p>
      <span class="q-price">${() => price(q.price.value)}</span>
      <span class=${() => `q-change ${way(pct.value)}`}>${() => percent(pct.value)}</span>
      <dl class="q-range">
        <div><dt>High</dt><dd class="q-high">${() => price(q.high.value)}</dd></div>
        <div><dt>Low</dt><dd class="q-low">${() => price(q.low.value)}</dd></div>
        <div><dt>Volume</dt><dd class="q-vol">${() => count(q.volume.value)}</dd></div>
      </dl>
    </section>
    ${chart(q, feed)}
    <div class="panels">
      ${book(q, feed)}
      <section class="panel tape" id="tape" aria-labelledby="tape-title">
        <h2 id="tape-title">Trades</h2>
        <div class="tape-row book-head"><span>Time</span><span>Price</span><span>Size</span></div>
        <div class="tape-scroll">
          <ul class="tape-list">${repeat(tape, (t) => t.id, (t) => html`
            <li class="tape-row"><span class="tape-time">${t.time}</span><span class=${t.side === 'buy' ? 'tape-price up' : 'tape-price down'}>${price(t.price)}</span><span class="tape-size">${count(t.size)}</span></li>`)}</ul>
        </div>
      </section>
    </div>`;
}

/** 120 candles: the first 119 are drawn once per y range, the last one and the price line follow the price.
 * @param {Quote} q @param {Feed} feed */
function chart(q, feed) {
  const candles = feed.candles(q.symbol);
  const n = candles.length;
  const fixed = extent(candles);
  const base = candles[n - 1];
  const range = computed(() => rangeKey(fixed, q.price.value)); // a string: changes only when the price leaves it
  const draw = (/** @type {string} */ key) => {
    const s = scale(key, n);
    const last = computed(() => candleShape(lastCandle(base, q.price.value), n - 1, s));
    const line = computed(() => priceLine(q.price.value, s));
    return html`
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${`${q.symbol}, ${n} one-minute candles`}>
        ${s.grid.map((g) => svg`<path class="chart-grid" d=${`M4 ${g.y}H${W - RIGHT}`}/><text class="chart-tick" x=${W - RIGHT + 8} y=${g.y} dominant-baseline="middle">${price(g.value)}</text>`)}
        ${candles.slice(0, -1).map((c, i) => {
          const k = candleShape(c, i, s);
          return svg`<g class=${k.cls}><path class="cdl-wick" d=${k.wick}/><rect class="cdl-body" x=${k.x} y=${k.y} width=${k.w} height=${k.h}/></g>`;
        })}
        <g class=${() => `${last.value.cls} last`}><path class="cdl-wick" d=${() => last.value.wick}/><rect class="cdl-body" x=${() => last.value.x} y=${() => last.value.y} width=${() => last.value.w} height=${() => last.value.h}/></g>
        <g class=${() => `last-price ${way(q.price.value - q.prevClose)}`}>
          <path class="last-line" d=${() => line.value.d}/>
          <rect class="last-tag" x=${() => line.value.tagX} y=${() => line.value.tagY} width=${RIGHT - 4} height="20" rx="4"/>
          <text class="last-text" x=${() => line.value.textX} y=${() => line.value.y} dominant-baseline="middle">${() => price(q.price.value)}</text>
        </g>
      </svg>`;
  };
  return html`<section class="panel chart" id="chart" aria-label="Chart">${() => draw(range.value)}</section>`;
}

/** 10 asks and 10 bids around the live price. @param {Quote} q @param {Feed} feed */
function book(q, feed) {
  const levels = computed(() => feed.book(q.symbol, q.price.value));
  const level = (/** @type {'asks' | 'bids'} */ side, /** @type {number} */ i) => {
    const l = () => levels.value[side][i];
    const cls = side === 'asks' ? 'book-row ask' : i === 0 ? 'book-row bid best' : 'book-row bid';
    return html`<li class=${cls} style=${() => `--depth: ${(l().depth * 100).toFixed(1)}%`}><span class="book-price">${() => price(l().price)}</span><span class="book-size">${() => count(l().size)}</span><span class="book-total">${() => count(l().total)}</span></li>`;
  };
  const ten = Array.from({ length: 10 }, (_, i) => i);
  return html`
    <section class="panel book" id="book" aria-labelledby="book-title">
      <h2 id="book-title">Order book</h2>
      <div class="book-row book-head"><span>Price</span><span>Size</span><span>Total</span></div>
      <ul class="book-list">${ten.map((i) => level('asks', i))}${ten.map((i) => level('bids', i))}</ul>
    </section>`;
}
