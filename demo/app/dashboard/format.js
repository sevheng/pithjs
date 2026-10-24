// Number and date formats for the dashboard. Dates come as 'YYYY-MM-DD' days and are shown in UTC,
// so a day never shifts with the viewer's time zone.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('en-US');

/** $86,962 @param {number} n */
export const money = (n) => usd.format(n);
/** $85.09 @param {number} n */
export const cents = (n) => usdCents.format(n);
/** $4K, for axis ticks @param {number} n */
export const compactMoney = (n) => usdCompact.format(n);
/** 1,022 @param {number} n */
export const count = (n) => whole.format(n);

/** @param {string} d 'YYYY-MM-DD' */
const at = (d) => new Date(`${d}T00:00:00Z`);
/** Oct 23 @param {string} d */
export const day = (d) => at(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** Fri, Oct 23 @param {string} d */
export const weekday = (d) => at(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** October 23, 2026 @param {string} d */
export const fullDay = (d) => at(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * Round axis ticks from 0: about `n` steps of 1, 2, 2.5 or 5 × a power of ten, covering `max`.
 * @param {number} max @param {number} [n]
 */
export function niceTicks(max, n = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
