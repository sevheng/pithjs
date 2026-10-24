// Number and time formats for the trading screen. Candle times are exchange time, written as UTC by the
// dev API, so they're shown in UTC and never shift with the viewer's time zone.
import { cents, count } from '../dashboard/format.js';

export { cents, count };

const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** 148.20 (a price without the $, for dense tables) @param {number} n */
export const price = (n) => two.format(n);
/** +1.24% / −0.80% (a real minus sign) @param {number} n */
export const percent = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${two.format(Math.abs(n))}%`;
/** +1.85 / −0.40 @param {number} n */
export const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${two.format(Math.abs(n))}`;
/** +$1,204.50 / −$80.00 @param {number} n */
export const signedMoney = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${cents(Math.abs(n))}`;
/** 1.2M @param {number} n */
export const volume = (n) => compact.format(n);
/** 'up', 'down' or 'flat', for a class @param {number} n */
export const way = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

const utc = (/** @type {Intl.DateTimeFormatOptions} */ o) => new Intl.DateTimeFormat('en-US', { ...o, timeZone: 'UTC' });
const hm = utc({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayHm = utc({ weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const md = utc({ month: 'short', day: 'numeric' });
const mdy = utc({ month: 'short', day: 'numeric', year: 'numeric' });
const wd = utc({ weekday: 'short', day: 'numeric' });
const mon = utc({ month: 'short' });

/** A candle's time on the axis, by timeframe: 10:30 · Mon 19 · Oct 6 · Jan @param {string} t @param {string} tf */
export const axisTime = (t, tf) => {
  const d = new Date(t);
  return tf === '1D' ? hm.format(d) : tf === '1W' ? wd.format(d) : tf === '1M' ? md.format(d) : mon.format(d);
};
/** A candle's time in the tooltip and the table: 10:35 · Mon 10:30 · Oct 6 · Week of Oct 6, 2026 @param {string} t @param {string} tf */
export const candleTime = (t, tf) => {
  const d = new Date(t);
  return tf === '1D' ? hm.format(d) : tf === '1W' ? dayHm.format(d) : tf === '1M' ? md.format(d) : `Week of ${mdy.format(d)}`;
};
/** 14:05:09, the viewer's clock (for trades and orders placed now) @param {number | string} t */
export const clock = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * About `n` round ticks between lo and hi (steps of 1, 2, 2.5 or 5 × a power of ten).
 * @param {number} lo @param {number} hi @param {number} [n]
 */
export function rangeTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return { ticks: out, step };
}
