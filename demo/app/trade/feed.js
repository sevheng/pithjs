import { signal, batch, effect, onCleanup } from 'pith';

// The market feed, simulated in the browser: the dev server only answers JSON, it can't stream. A seeded
// random walk moves each symbol's price from where the API left it, so a test sees the same kind of moves on
// every run. Each quote keeps the fields that change in signals (price, high, low, volume, the last trade), and
// every timer step writes all its ticks in one batch(): the watchlist row, the chart's last candle and the
// P&L that read a price update in place, and nothing else is rebuilt (docs: Lists, "Rows that change often").
//
// Made in the trade layout (it owns the timers): they stop when the layout goes away, while paused, while the
// feed is down, and while the tab is hidden.

/** How often the feed steps, and how many symbols tick in each step ('all' = every symbol). */
export const SPEEDS = /** @type {const} */ ({
  1: { every: 400, picks: 6, label: '1×' },
  10: { every: 100, picks: 15, label: '10×' },
  stress: { every: 16, picks: 'all', label: 'Stress' },
});

/**
 * @typedef {{ symbol: string, name: string, sector: string, price: number, vol: number, open: number, high: number,
 *   low: number, volume: number, prevClose: number, spark: number[] }} Instrument
 * @typedef {{ id: number, price: number, size: number, side: 'buy' | 'sell', at: number }} Trade
 * @typedef {ReturnType<typeof toQuote>} Quote
 */

// mulberry32, the same generator as the dev API.
function random(/** @type {number} */ seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;

/** One symbol: what's fixed for the day, and a signal for each field that ticks. @param {Instrument} i */
function toQuote(i) {
  return {
    symbol: i.symbol, name: i.name, sector: i.sector, vol: i.vol, base: i.price,
    open: i.open, prevClose: i.prevClose, spark: i.spark,
    price: signal(i.price),
    high: signal(i.high),
    low: signal(i.low),
    volume: signal(i.volume),
    /** The last tick's direction: 1 up, -1 down, 0 none yet. */
    move: signal(0),
    /** Counts ticks, so a flash can start again on each one. */
    ticks: signal(0),
    trade: signal(/** @type {Trade | null} */ (null)),
  };
}

/** @param {{ seed?: number }} [options] */
export function createFeed({ seed = 7 } = {}) {
  const rand = random(seed);
  const quotes = signal(/** @type {Quote[]} */ ([]));
  /** @type {Map<string, Quote>} */
  const bySymbol = new Map();
  const running = signal(true);
  const speed = signal(/** @type {keyof typeof SPEEDS} */ ('1'));
  /** 'live', 'down' (lost; waits retryIn seconds) or 'connecting' */
  const status = signal(/** @type {'live' | 'down' | 'connecting'} */ ('live'));
  const retryIn = signal(0);
  /** The symbol on screen: it ticks in every step, so its chart, book and trades stay busy. */
  const focus = signal(/** @type {string | null} */ (null));
  /** Measured over the last second: updates per second, and the time one step took to apply (ms). */
  const stats = signal(/** @type {{ perSec: number, avg: number, worst: number } | null} */ (null));
  const hidden = signal(typeof document !== 'undefined' && document.hidden);
  let outage = false; // ?feed=down: reconnecting fails until Retry is pressed
  let tradeId = 0;

  /** @param {Instrument[]} list */
  const load = (list) => {
    if (quotes.peek().length) return; // a refetch keeps the live prices
    const made = list.map(toQuote);
    for (const q of made) bySymbol.set(q.symbol, q);
    quotes.value = made;
  };

  /** Move one quote by a small random step (pulled gently back toward the day's price). @param {Quote} q */
  const tick = (q) => {
    const p = q.price.peek();
    const sigma = q.vol / 100 / 60; // one tick: a small part of the day's usual move
    const r = (rand() + rand() + rand() - 1.5) * sigma + ((q.base - p) / q.base) * 0.01;
    let next = Math.max(0.05, round2(p * (1 + r)));
    if (next === p) next = round2(p + (rand() < 0.5 ? -0.01 : 0.01));
    const size = Math.round(1 + rand() ** 3 * 60) * 10;
    q.price.value = next;
    q.move.value = next > p ? 1 : -1;
    q.ticks.value++;
    if (next > q.high.peek()) q.high.value = next;
    if (next < q.low.peek()) q.low.value = next;
    q.volume.value += size;
    q.trade.value = { id: ++tradeId, price: next, size, side: next > p ? 'buy' : 'sell', at: Date.now() };
  };

  let count = 0;
  let steps = 0;
  let spent = 0;
  let worst = 0;
  let since = 0;
  const step = () => {
    const list = quotes.peek();
    const { picks } = SPEEDS[speed.peek()];
    /** @type {Set<Quote>} */
    let chosen;
    if (picks === 'all') chosen = new Set(list);
    else {
      chosen = new Set();
      while (chosen.size < picks) chosen.add(list[Math.floor(rand() * list.length)]);
      const f = focus.peek() && bySymbol.get(/** @type {string} */ (focus.peek()));
      if (f) chosen.add(f);
    }
    const t = performance.now();
    batch(() => chosen.forEach(tick)); // effects run once, at the end: this is the DOM work of the step
    const ms = performance.now() - t;
    count += chosen.size;
    steps += 1;
    spent += ms;
    worst = Math.max(worst, ms);
    if (t - since >= 1000) {
      if (since) stats.value = { perSec: Math.round((count * 1000) / (t - since)), avg: spent / steps, worst };
      since = t;
      count = steps = spent = worst = 0;
    }
  };

  // The timer runs only while there is something to move, it's running and live, and the tab is visible.
  effect(() => {
    if (!quotes.value.length || !running.value || status.value !== 'live' || hidden.value) return;
    const { every } = SPEEDS[speed.value];
    since = count = steps = spent = worst = 0;
    const id = setInterval(step, every);
    return () => {
      clearInterval(id);
      stats.value = null;
    };
  });

  // Down: count down to the next try, then try. With ?feed=down a try fails, until Retry.
  effect(() => {
    if (status.value === 'down') {
      retryIn.value = 5;
      const id = setInterval(() => {
        if (retryIn.peek() > 1) retryIn.value--;
        else status.value = 'connecting';
      }, 1000);
      return () => clearInterval(id);
    }
    if (status.value === 'connecting') {
      const id = setTimeout(() => (status.value = outage ? 'down' : 'live'), 900);
      return () => clearTimeout(id);
    }
    return undefined;
  });

  const onVisibility = () => (hidden.value = document.hidden);
  document.addEventListener('visibilitychange', onVisibility);
  onCleanup(() => document.removeEventListener('visibilitychange', onVisibility));

  return {
    quotes,
    /** @param {string} symbol */
    get: (symbol) => bySymbol.get(symbol),
    running,
    speed,
    status,
    retryIn,
    focus,
    stats,
    load,
    /** Lose the connection (the ?feed=down demo): it keeps failing to reconnect until retry(). */
    drop() {
      outage = true;
      status.value = 'down';
    },
    /** Try to connect now. */
    retry() {
      outage = false;
      status.value = 'connecting';
    },
  };
}

/** @typedef {ReturnType<typeof createFeed>} Feed */
