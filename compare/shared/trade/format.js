// Number formats and the small pure calculations every implementation shows the same way.

const two = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const MINUS = '−';
const sign = (/** @type {number} */ n) => (n > 0 ? '+' : n < 0 ? MINUS : '');

/** 1,148.20 @param {number} n */
export const price = (n) => two.format(n);
/** +1.24% / −0.80% (a real minus sign) @param {number} n */
export const percent = (n) => `${sign(n)}${two.format(Math.abs(n))}%`;
/** $1,204.50 @param {number} n */
export const money = (n) => `$${two.format(n)}`;
/** +$1,204.50 / −$80.00 @param {number} n */
export const signedMoney = (n) => `${sign(n)}$${two.format(Math.abs(n))}`;
/** 12,400 @param {number} n */
export const count = (n) => whole.format(n);
/** 'up', 'down' or 'flat', for a class @param {number} n */
export const way = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat');

/** The change since the previous close, in %. @param {number} p @param {number} prevClose */
export const changePct = (p, prevClose) => ((p - prevClose) / prevClose) * 100;

/** The price's class on a tick: alternates between two names, so the flash animation starts again each time.
 * @param {number} move 1 up, -1 down, 0 no tick yet @param {number} ticks */
export const flashClass = (move, ticks) => (ticks ? `wl-price flash-${move > 0 ? 'up' : 'down'}-${ticks % 2}` : 'wl-price');
/** ▲, ▼ or nothing @param {number} move */
export const arrow = (move) => (move > 0 ? '▲' : move < 0 ? '▼' : '');

export const SPARK_W = 64;
export const SPARK_H = 22;
/** The sparkline's polyline points. @param {number[]} values */
export function sparkPoints(values) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  const dx = SPARK_W / (values.length - 1);
  let out = '';
  for (let i = 0; i < values.length; i++) {
    out += `${i ? ' ' : ''}${(i * dx).toFixed(1)},${(SPARK_H - 2 - ((values[i] - lo) / span) * (SPARK_H - 4)).toFixed(1)}`;
  }
  return out;
}
