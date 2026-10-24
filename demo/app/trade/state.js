import { signal, createStore, fetchJSON } from 'pith';

// Shared by the trade layout (the watchlist, the feed, the account bar) and the symbol page (chart, book,
// ticket, positions). The layout makes the feed and the account resource and puts them here; the page reads
// them, so switching symbols keeps the same live prices and doesn't load the account again.

export const market = signal(/** @type {import('./feed.js').Feed | null} */ (null));

/**
 * The account resource ({ cash, buyingPower, positions, orders }), made by the layout.
 * @type {{ current: any }}
 */
export const account = { current: null };

// Starred symbols go to the top of the watchlist. Saved, so they survive a reload (and follow other tabs).
export const watch = createStore({ stars: ['NWX', 'QUIL', 'AURX'] }, { persist: 'pith-trade' });

export const DEFAULT_SYMBOL = 'NWX';
export const TIMEFRAMES = /** @type {const} */ (['1D', '1W', '1M', '1Y']);

// A symbol's candles, kept once loaded and asked for as soon as its watchlist row is pointed at or focused, so
// picking a symbol usually finds its chart already here and only the numbers change. Failed loads aren't kept.
/** @type {Map<string, Promise<any>>} */
const candleCache = new Map();
/** @param {string} symbol @param {string} tf */
export function candles(symbol, tf) {
  const key = `${symbol}:${tf}`;
  let got = candleCache.get(key);
  if (!got) {
    got = fetchJSON(`/api/trade?symbol=${encodeURIComponent(symbol)}&tf=${tf}`);
    got.catch(() => candleCache.delete(key));
    candleCache.set(key, got);
  }
  return got;
}
