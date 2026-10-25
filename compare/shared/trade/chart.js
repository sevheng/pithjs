// The candlestick chart's geometry, the same in every implementation: each one only decides how the shapes
// get into the DOM. The y range is in round steps and is a string key, so it changes (and the 119 fixed candles
// are drawn again) only when the live price crosses out of it; on other ticks only the last candle and the
// last-price line move.

/** @typedef {import('./feed.js').Candle} Candle */

export const W = 640;
export const H = 240;
const TOP = 10;
const BOTTOM = 20;
const LEFT = 4;
export const RIGHT = 60;

/** About n round ticks between lo and hi (steps of 1, 2, 2.5 or 5 × a power of ten). @param {number} lo @param {number} hi */
function niceStep(lo, hi, n = 5) {
  const raw = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
}

/** The lowest low and highest high of the candles. @param {Candle[]} candles */
export function extent(candles) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of candles) {
    if (c.l < lo) lo = c.l;
    if (c.h > hi) hi = c.h;
  }
  return { lo, hi };
}

/** The newest candle with the live price as its close. @param {Candle} base @param {number} p @returns {Candle} */
export const lastCandle = (base, p) => ({ ...base, c: p, h: Math.max(base.h, p), l: Math.min(base.l, p) });

/** The y range as a key: "lo|hi" in round steps, covering the candles and the live price.
 * @param {{ lo: number, hi: number }} fixed @param {number} p */
export function rangeKey(fixed, p) {
  const lo = Math.min(fixed.lo, p);
  const hi = Math.max(fixed.hi, p);
  const s = niceStep(lo, hi);
  return `${Math.round(Math.floor(lo / s) * s * 1e6) / 1e6}|${Math.round(Math.ceil(hi / s) * s * 1e6) / 1e6}`;
}

/** x and y for a range key, and its grid lines. @param {string} key @param {number} n */
export function scale(key, n) {
  const [lo, hi] = key.split('|').map(Number);
  const slot = (W - LEFT - RIGHT) / n;
  const y = (/** @type {number} */ v) => TOP + (H - TOP - BOTTOM) * (1 - (v - lo) / (hi - lo || 1));
  const step = niceStep(lo, hi);
  const grid = [];
  for (let v = lo; v <= hi + 1e-9; v += step) grid.push({ value: Math.round(v * 1e6) / 1e6, y: y(v).toFixed(1) });
  return { lo, hi, slot, body: Math.max(1, slot * 0.62), x: (/** @type {number} */ i) => LEFT + (i + 0.5) * slot, y, grid };
}

/** One candle's shapes: its class, the wick's path and the body's rect.
 * @param {Candle} c @param {number} i @param {ReturnType<typeof scale>} s */
export function candleShape(c, i, s) {
  const x = s.x(i);
  const top = s.y(Math.max(c.o, c.c));
  return {
    cls: c.c >= c.o ? 'cdl up' : 'cdl down',
    wick: `M${x.toFixed(1)} ${s.y(c.h).toFixed(1)}V${s.y(c.l).toFixed(1)}`,
    x: (x - s.body / 2).toFixed(1),
    y: top.toFixed(1),
    w: s.body.toFixed(1),
    h: Math.max(1, s.y(Math.min(c.o, c.c)) - top).toFixed(1),
  };
}

/** The last-price line and its tag. @param {number} p @param {ReturnType<typeof scale>} s */
export function priceLine(p, s) {
  const y = s.y(p);
  return { d: `M${LEFT} ${y.toFixed(1)}H${W - RIGHT}`, y: y.toFixed(1), tagY: (y - 10).toFixed(1), tagX: W - RIGHT + 2, textX: W - RIGHT + 8 };
}
