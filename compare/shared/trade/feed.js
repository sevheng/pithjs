// The trading benchmark's market: a seeded random walk, the same for every implementation (Pith, React, Vue).
// Plain JavaScript, no framework: each app keeps what it shows in its own state and applies the ticks
// step() returns with its own normal update. The feed keeps only what a real market feed would: each
// symbol's last price, high, low and volume (to walk on from), and the trades of the symbols that were asked
// for with trades(). Same n and seed: the same symbols, candles, books, positions and ticks, call for call.

/** @typedef {{ symbol: string, index: number, name: string, prevClose: number, price: number, high: number,
 *   low: number, volume: number, spark: number[] }} Instrument
 * @typedef {{ id: number, price: number, size: number, side: 'buy' | 'sell', time: string }} Trade
 * @typedef {{ symbol: string, index: number, price: number, move: 1 | -1, high: number, low: number,
 *   volume: number, trade: Trade }} Tick
 * @typedef {{ t: number, o: number, h: number, l: number, c: number }} Candle
 * @typedef {{ price: number, size: number, total: number, depth: number }} Level
 */

export const SPARK = 20; // points in a watchlist sparkline
export const CANDLES = 120; // candles in the chart
export const LEVELS = 10; // order book levels on each side
export const TAPE = 30; // trades in the tape
export const CASH = 25_000;

/** mulberry32: a tiny seeded random number generator. @param {number} seed */
export function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (/** @type {string} */ text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const round2 = (/** @type {number} */ n) => Math.round(n * 100) / 100;

const FIRST = ['North', 'Helix', 'Orbit', 'Kestrel', 'Fern', 'Quill', 'Brook', 'Mosaic', 'Tidal', 'Sprocket', 'Cedar',
  'Vyla', 'Aurora', 'Glimmer', 'Harbor', 'Maple', 'Nebula', 'Oaken', 'Polar', 'Quartz', 'Raven', 'Salt', 'Timber',
  'Umbra', 'Vantage', 'Whisper', 'Xplor', 'Yarrow', 'Zenith', 'Alder', 'Basalt', 'Canopy', 'Drift', 'Ember', 'Fjord',
  'Granite', 'Humming', 'Iris', 'Juniper', 'Kelp'];
const SECOND = ['wind', 'light', 'stone', 'field', 'water', 'crest', 'line', 'works', 'gate', 'bridge', 'peak', 'vale'];
const KIND = ['Group', 'Systems', 'Energy', 'Foods', 'Robotics', 'Therapeutics', 'Software', 'Freight', 'Bank',
  'Minerals', 'Labs', 'Power', 'Homes', 'Optics', 'Health', 'Holdings'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const DAY_START = 10 * 3600; // the tape's clock starts at 10:00:00
const two = (/** @type {number} */ n) => String(n).padStart(2, '0');
const clock = (/** @type {number} */ s) => `${two(Math.floor(s / 3600) % 24)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;

/** @param {{ n?: number, seed?: number }} [options] */
export function createFeed({ n = 40, seed = 7 } = {}) {
  const rand = random(seed);

  // ---------- The symbols ----------
  /** @type {Instrument[]} */
  const symbols = [];
  /** @type {{ price: number, high: number, low: number, volume: number, vol: number, base: number }[]} */
  const live = [];
  const taken = new Set();
  for (let i = 0; i < n; i++) {
    let symbol;
    do {
      const len = rand() < 0.7 ? 4 : 3;
      symbol = Array.from({ length: len }, () => LETTERS[Math.floor(rand() * 26)]).join('');
    } while (taken.has(symbol));
    taken.add(symbol);
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]}${SECOND[Math.floor(rand() * SECOND.length)]} ${KIND[Math.floor(rand() * KIND.length)]}`;
    const price = round2(8 + rand() ** 2 * 300);
    const vol = 0.8 + rand() * 3.2; // the daily move, in %
    // The day so far, walked back from the price: the sparkline's 20 points, ending at the price.
    const spark = [price];
    for (let k = 1; k < SPARK; k++) spark.unshift(round2(spark[0] * (1 + (rand() - 0.5) * vol * 0.006)));
    const prevClose = round2(spark[0] * (1 + (rand() - 0.5) * vol * 0.004));
    const high = Math.max(...spark, prevClose);
    const low = Math.min(...spark, prevClose);
    const volume = Math.round(50_000 + rand() * 2_000_000);
    symbols.push({ symbol, index: i, name, prevClose, price, high, low, volume, spark });
    live.push({ price, high, low, volume, vol, base: price });
  }
  /** @type {Map<string, number>} */
  const indexOf = new Map(symbols.map((s) => [s.symbol, s.index]));

  // ---------- Positions: 5 symbols spread over the list ----------
  const positions = [0, 3, 7, 12, 21].map((at, k) => {
    const s = symbols[at % n];
    return { symbol: s.symbol, index: s.index, qty: (k + 1) * 25 + Math.round(rand() * 50), avg: round2(s.prevClose * (0.94 + rand() * 0.1)) };
  }).filter((p, i, all) => all.findIndex((q) => q.symbol === p.symbol) === i);

  // ---------- Ticks ----------
  let cursor = 0;
  let tradeId = 0;
  let seconds = DAY_START;
  /** @type {Map<string, Trade[]>} */
  const tapes = new Map();

  /**
   * One step of the market: k symbols tick, the next k after the last step's (wrapping around), so over a few
   * steps every symbol ticks. Each tick has the symbol's new price, its direction, high, low and volume, and the
   * trade that made it.
   * @param {number} k
   * @returns {Tick[]}
   */
  function step(k) {
    k = Math.max(0, Math.min(k, n));
    seconds += 1;
    const time = clock(seconds);
    /** @type {Tick[]} */
    const out = new Array(k);
    for (let j = 0; j < k; j++) {
      const index = cursor;
      cursor = (cursor + 1) % n;
      const s = live[index];
      const p = s.price;
      const sigma = s.vol / 100 / 30;
      const r = (rand() + rand() + rand() - 1.5) * sigma + ((s.base - p) / s.base) * 0.02;
      let next = Math.max(0.05, round2(p * (1 + r)));
      if (next === p) next = round2(p + (rand() < 0.5 ? -0.01 : 0.01));
      const size = Math.round(1 + rand() ** 3 * 60) * 10;
      s.price = next;
      if (next > s.high) s.high = next;
      if (next < s.low) s.low = next;
      s.volume += size;
      const move = next > p ? 1 : -1;
      /** @type {Trade} */
      const trade = { id: ++tradeId, price: next, size, side: move > 0 ? 'buy' : 'sell', time };
      const symbol = symbols[index].symbol;
      const tape = tapes.get(symbol);
      if (tape) tapes.set(symbol, [trade, ...tape.slice(0, TAPE - 1)]);
      out[j] = { symbol, index, price: next, move, high: s.high, low: s.low, volume: s.volume, trade };
    }
    return out;
  }

  // ---------- The selected symbol's chart, book and trades ----------
  /** @type {Map<string, Candle[]>} */
  const candleCache = new Map();
  /**
   * The symbol's last 120 one-minute candles, oldest first, walked back from its starting price (so the newest
   * closes at it). The same array on every call.
   * @param {string} symbol
   */
  function candles(symbol) {
    let list = candleCache.get(symbol);
    if (list) return list;
    const s = symbols[/** @type {number} */ (indexOf.get(symbol))];
    const r = random(hash(symbol));
    const per = live[s.index].vol / 100 / Math.sqrt(CANDLES);
    list = [];
    let close = s.price;
    for (let i = CANDLES - 1; i >= 0; i--) {
      const open = round2(close * (1 + (r() - 0.5) * 2 * per));
      const h = round2(Math.max(open, close) * (1 + r() * per * 0.6));
      const l = round2(Math.min(open, close) * (1 - r() * per * 0.6));
      list.unshift({ t: i, o: open, h, l, c: close });
      close = open;
    }
    candleCache.set(symbol, list);
    return list;
  }

  /**
   * 10 asks and 10 bids around a price. Both are listed top to bottom as a book shows them: asks from the
   * highest down to the one just above the price, then bids from the price down. The sizes depend only on the
   * symbol and the price, so the same price always shows the same book.
   * @param {string} symbol @param {number} price
   * @returns {{ asks: Level[], bids: Level[] }}
   */
  function book(symbol, price) {
    const r = random(hash(symbol) ^ Math.round(price * 100));
    const inc = price < 20 ? 0.01 : price < 100 ? 0.02 : 0.05;
    const lot = (/** @type {number} */ i) => Math.round((2 + r() * 18 + i * 3) * (price < 50 ? 50 : 10)) * 10;
    const askSizes = Array.from({ length: LEVELS }, (_, i) => lot(i));
    const bidSizes = Array.from({ length: LEVELS }, (_, i) => lot(i));
    let a = 0;
    let b = 0;
    const askTotals = askSizes.map((x) => (a += x));
    const bidTotals = bidSizes.map((x) => (b += x));
    const most = Math.max(a, b);
    const asks = askSizes.map((size, i) => ({ price: round2(price + inc * (i + 1)), size, total: askTotals[i], depth: askTotals[i] / most })).reverse();
    const bids = bidSizes.map((size, i) => ({ price: round2(price - inc * i), size, total: bidTotals[i], depth: bidTotals[i] / most }));
    return { asks, bids };
  }

  /**
   * The symbol's last 30 trades, newest first. The first call makes a seeded history (trades before now); from
   * then on every tick of the symbol adds its trade at the top. A new array after each change.
   * @param {string} symbol
   * @returns {Trade[]}
   */
  function trades(symbol) {
    let tape = tapes.get(symbol);
    if (tape) return tape;
    const index = /** @type {number} */ (indexOf.get(symbol));
    const s = live[index];
    const r = random(hash(`${symbol}:tape`));
    tape = [];
    let p = s.price;
    for (let i = 0; i < TAPE; i++) {
      const prev = round2(p * (1 + (r() - 0.5) * 0.002));
      tape.push({ id: -(index * TAPE + i + 1), price: p, size: Math.round(1 + r() ** 3 * 60) * 10, side: p >= prev ? 'buy' : 'sell', time: clock(seconds - 2 * i - 1) });
      p = prev;
    }
    tapes.set(symbol, tape);
    return tape;
  }

  return {
    n,
    /** The symbols as they start: symbol, name, previous close, price, high, low, volume and 20 sparkline points. */
    symbols,
    /** 5 positions: { symbol, index, qty, avg } */
    positions,
    cash: CASH,
    step,
    candles,
    book,
    trades,
    /** A symbol's current price (for checks). @param {string} symbol */
    price: (symbol) => live[/** @type {number} */ (indexOf.get(symbol))].price,
    /** @param {string} symbol */
    indexOf: (symbol) => indexOf.get(symbol),
  };
}

/** @typedef {ReturnType<typeof createFeed>} Feed */

/** n from ?n= (default 40, at least 1, at most 10,000). */
export function sizeFromUrl() {
  const n = Number(new URLSearchParams(location.search).get('n'));
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 40;
}

/**
 * window.bench's timer: steps of k symbols, stepsPerSecond times a second, until stop().
 * @param {(k: number) => unknown} step
 */
export function timer(step) {
  /** @type {ReturnType<typeof setInterval> | 0} */
  let id = 0;
  return {
    /** @param {number} stepsPerSecond @param {number} k */
    start(stepsPerSecond, k) {
      clearInterval(id);
      id = setInterval(() => step(k), 1000 / stepsPerSecond);
    },
    stop() {
      clearInterval(id);
      id = 0;
    },
  };
}
