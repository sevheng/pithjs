import { html, svg, signal, computed } from 'pith';
import { measured, step } from '../dashboard/charts.js';
import { price, volume, axisTime, candleTime, rangeTicks, way } from './format.js';

// A candlestick chart with volume bars, drawn as inline SVG at the measured width of its box (the same
// approach as the dashboard's charts, reusing their measured() and step()). The candles from the API are
// drawn once; only the last candle, the last-price line and the crosshair read live signals, so a tick
// moves three small things. The whole drawing is made again only when the price leaves the y axis's range.
//
// Pointer and arrow keys pick a candle: a tooltip shows its numbers, a live region says them, and "Show the
// numbers" opens every candle as a table.

/** @typedef {{ t: string, o: number, h: number, l: number, c: number, v: number }} Candle */

export const CHART_H = 340; // the loading skeleton reserves the same height
const PRICE_TOP = 12;
const PRICE_H = 228;
const VOL_TOP = PRICE_TOP + PRICE_H + 18;
const VOL_H = 52;
const PAD = { left: 6, right: 64 };
const FALLBACK = 640;

/**
 * @param {{ symbol: string, tf: string, every: string, candles: Candle[] }} data
 * @param {import('./feed.js').Quote} quote
 */
export function candleChart(data, quote) {
  const { width, measure } = measured();
  const active = signal(/** @type {number | null} */ (null));
  const { candles, tf } = data;
  const n = candles.length;
  const base = candles[n - 1];
  const startVolume = quote.volume.peek();

  // The newest candle follows the feed: its close is the live price, its high and low stretch to meet it,
  // and its volume grows by what traded since the chart opened.
  const last = computed(() => {
    const p = quote.price.value;
    return { ...base, c: p, h: Math.max(base.h, p), l: Math.min(base.l, p), v: base.v + (quote.volume.value - startVolume) };
  });
  const at = (/** @type {number} */ i) => (i === n - 1 ? last.value : candles[i]);

  // The y range, in round steps. A string, so it only changes (and the chart redraws) when the price
  // crosses into a new step outside it.
  const fixedLo = Math.min(...candles.slice(0, -1).map((c) => c.l), base.l);
  const fixedHi = Math.max(...candles.slice(0, -1).map((c) => c.h), base.h);
  const range = computed(() => {
    const lo = Math.min(fixedLo, last.value.l);
    const hi = Math.max(fixedHi, last.value.h);
    const { step: s } = rangeTicks(lo, hi, 5);
    return `${Math.floor(lo / s) * s}|${Math.ceil(hi / s) * s}`;
  });
  const maxVol = Math.max(...candles.map((c) => c.v)) * 1.15;

  const summary = `${quote.symbol}, ${data.every} candles from ${candleTime(candles[0].t, tf)} to ${candleTime(base.t, tf)}: `
    + `opened at ${price(candles[0].o)}, high ${price(fixedHi)}, low ${price(fixedLo)}, last ${price(base.c)}.`;

  /** @param {number} w @param {string} key */
  const scale = (w, key) => {
    const [lo, hi] = key.split('|').map(Number);
    const plotW = w - PAD.left - PAD.right;
    const slot = plotW / n;
    return {
      lo, hi, plotW, slot,
      x: (/** @type {number} */ i) => PAD.left + (i + 0.5) * slot,
      y: (/** @type {number} */ v) => PRICE_TOP + PRICE_H * (1 - (v - lo) / (hi - lo || 1)),
      vy: (/** @type {number} */ v) => VOL_TOP + VOL_H * (1 - Math.min(1, v / maxVol)),
    };
  };

  /** One candle: a wick from high to low, a body from open to close, and its volume bar. */
  const candle = (/** @type {Candle} */ c, /** @type {number} */ i, /** @type {ReturnType<typeof scale>} */ s) => {
    const body = Math.max(1, s.slot * 0.62);
    const x = s.x(i);
    const top = s.y(Math.max(c.o, c.c));
    const h = Math.max(1, s.y(Math.min(c.o, c.c)) - top);
    const dir = c.c >= c.o ? 'up' : 'down';
    return svg`<g class=${`cdl ${dir}`}>
      <path class="cdl-wick" d=${`M${x.toFixed(1)} ${s.y(c.h).toFixed(1)}V${s.y(c.l).toFixed(1)}`}/>
      <rect class="cdl-body" x=${(x - body / 2).toFixed(1)} y=${top.toFixed(1)} width=${body.toFixed(1)} height=${h.toFixed(1)} rx=${body > 4 ? 1 : 0}/>
      <rect class="cdl-vol" x=${(x - body / 2).toFixed(1)} y=${s.vy(c.v).toFixed(1)} width=${body.toFixed(1)} height=${(VOL_TOP + VOL_H - s.vy(c.v)).toFixed(1)}/>
    </g>`;
  };

  /** @param {PointerEvent} e */
  const pick = (e) => {
    const box = /** @type {HTMLElement} */ (e.currentTarget).getBoundingClientRect();
    const s = scale(width.peek() || FALLBACK, range.peek());
    const i = Math.floor((e.clientX - box.left - PAD.left) / s.slot);
    active.value = Math.max(0, Math.min(n - 1, i));
  };

  /** @param {number} w @param {boolean} fit @param {string} key */
  const draw = (w, fit, key) => {
    const s = scale(w, key);
    const { ticks } = rangeTicks(s.lo, s.hi, 5);
    const grid = ticks.map((t) => `M${PAD.left} ${s.y(t).toFixed(1)}H${w - PAD.right}`).join('');
    const labels = Math.max(2, Math.min(n, Math.floor(s.plotW / 84)));
    const times = [...new Set(Array.from({ length: labels }, (_, k) => Math.round((k * (n - 1)) / (labels - 1))))];
    return html`
      <svg class="chart-svg candle-svg" width=${fit ? '100%' : w} height=${fit ? '100%' : CHART_H} viewBox=${`0 0 ${w} ${CHART_H}`} role="img" aria-label=${summary}>
        <path class="chart-grid" d=${grid}/>
        <path class="chart-axis" d=${`M${PAD.left} ${VOL_TOP + VOL_H}H${w - PAD.right}`}/>
        ${ticks.map((t) => svg`<text class="chart-tick" x=${w - PAD.right + 8} y=${s.y(t)} dominant-baseline="middle">${price(t)}</text>`)}
        ${times.map((i) => svg`<text class="chart-tick" x=${s.x(i)} y=${CHART_H - 6}
          text-anchor=${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>${axisTime(candles[i].t, tf)}</text>`)}
        ${candles.slice(0, -1).map((c, i) => candle(c, i, s))}
        ${() => candle(last.value, n - 1, s)}
        ${() => {
          const p = last.value.c;
          const y = s.y(p);
          const dir = way(p - quote.prevClose);
          return svg`<g class=${`last-price ${dir}`}>
            <path class="last-line" d=${`M${PAD.left} ${y.toFixed(1)}H${w - PAD.right}`}/>
            <rect class="last-tag" x=${w - PAD.right + 2} y=${(y - 10).toFixed(1)} width=${PAD.right - 4} height="20" rx="5"/>
            <text class="last-text" x=${w - PAD.right + 8} y=${y.toFixed(1)} dominant-baseline="middle">${price(p)}</text>
          </g>`;
        }}
        ${() => {
          const i = active.value;
          if (i === null) return null;
          const c = at(i);
          return svg`<path class="chart-cross" d=${`M${s.x(i).toFixed(1)} ${PRICE_TOP}V${VOL_TOP + VOL_H}M${PAD.left} ${s.y(c.c).toFixed(1)}H${w - PAD.right}`}/>`;
        }}
      </svg>
      ${() => {
        const i = active.value;
        if (i === null) return null;
        const c = at(i);
        const left = Math.max(92, Math.min(w - PAD.right - 92, s.x(i)));
        return html`<div class="chart-tip candle-tip" aria-hidden="true" style=${`left: ${left}px; top: ${PRICE_TOP + 4}px`}>
          <span>${candleTime(c.t, tf)}</span>
          <dl><dt>O</dt><dd>${price(c.o)}</dd><dt>H</dt><dd>${price(c.h)}</dd><dt>L</dt><dd>${price(c.l)}</dd>
            <dt>C</dt><dd class=${c.c >= c.o ? 'up' : 'down'}>${price(c.c)}</dd><dt>Vol</dt><dd>${volume(c.v)}</dd></dl></div>`;
      }}`;
  };

  const say = (/** @type {number} */ i) => {
    const c = at(i);
    return `${candleTime(c.t, tf)}: open ${price(c.o)}, high ${price(c.h)}, low ${price(c.l)}, close ${price(c.c)}, volume ${volume(c.v)}`;
  };

  return html`
    <div class="chart-box candle-box" tabindex="0" role="group" aria-label=${`${quote.symbol} price chart. Use the arrow keys to read each candle.`}
         ref=${measure} @pointermove=${pick} @pointerleave=${() => (active.value = null)}
         @keydown=${(/** @type {KeyboardEvent} */ e) => { const i = step(e, active.value, n); if (i !== undefined) active.value = i; }}
         @focus=${() => (active.value ??= n - 1)} @blur=${() => (active.value = null)}>
      ${() => draw(width.value || FALLBACK, !width.value, range.value)}
    </div>
    <p class="sr-only" aria-live="polite">${() => (active.value === null ? '' : say(active.value))}</p>
    <details class="chart-data">
      <summary>Show the numbers</summary>
      <div class="chart-table">
        <table>
          <thead><tr><th scope="col">Time</th><th scope="col" class="num">Open</th><th scope="col" class="num">High</th>
            <th scope="col" class="num">Low</th><th scope="col" class="num">Close</th><th scope="col" class="num">Volume</th></tr></thead>
          <tbody>${candles.toReversed().map((c) => html`<tr><td>${candleTime(c.t, tf)}</td><td class="num">${price(c.o)}</td>
            <td class="num">${price(c.h)}</td><td class="num">${price(c.l)}</td><td class="num">${price(c.c)}</td><td class="num">${volume(c.v)}</td></tr>`)}</tbody>
        </table>
      </div>
    </details>`;
}
