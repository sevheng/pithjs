// GET /api/trade?view=instruments → { exchange, day, instruments } (each with its last price, the day's open,
//     high, low and volume, the previous close and a small intraday line for the sparkline)
// GET /api/trade?symbol=NWX&tf=1D → { symbol, tf, candles: [{ t, o, h, l, c, v }] } (tf: 1D, 1W, 1M, 1Y)
// GET /api/trade?view=account → { cash, positions, orders }
// POST /api/trade { symbol, side, type, qty, limit, price } → the account, with the new order as `last`.
//     422 when the order is wrong or costs more than the buying power; ?fail answers 500.
// DELETE /api/trade?id=O-1002 → cancels an open order; returns the account.
// Dev-only demo data for "Northwind Markets", a made-up exchange: made-up companies, prices from a seeded random
// walk ending on a fixed day, so every run, test and screenshot sees the same chart. The live ticks after that
// come from the browser (app/trade/feed.js): this dev server only answers JSON.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const DAY = Date.UTC(2026, 9, 23); // Fri 23 Oct 2026, the trading day on screen
const OPEN_MIN = 9 * 60 + 30; // 09:30, in exchange time (shown as UTC so it never shifts)

// mulberry32: a tiny seeded random number generator (the same as api/dashboard.mjs).
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text) => [...text].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const round2 = (n) => Math.round(n * 100) / 100;

// [symbol, name, sector, last price, volatility (daily, %)]
const LIST = [
  ['NWX', 'Northwind Exchange Group', 'Financials', 148.2, 1.6],
  ['HLXB', 'Helix Biosystems', 'Health care', 62.35, 3.1],
  ['ORBF', 'Orbital Freight', 'Industrials', 23.8, 2.4],
  ['KSTA', 'Kestrel Aerospace', 'Industrials', 211.4, 1.9],
  ['FRNL', 'Fernlight Energy', 'Energy', 41.75, 2.6],
  ['QUIL', 'Quillstone Software', 'Technology', 57.9, 2.8],
  ['BRKW', 'Brookwater Utilities', 'Utilities', 34.1, 0.9],
  ['MOSA', 'Mosaic Pantry Foods', 'Consumer', 19.45, 1.4],
  ['TIDL', 'Tidal Grid Power', 'Utilities', 21.6, 1.2],
  ['SPRK', 'Sprocketworks Robotics', 'Technology', 96.3, 3.4],
  ['CDRP', 'Cedar & Pine Homes', 'Real estate', 72.15, 1.8],
  ['VYLM', 'Vyla Mobility', 'Consumer', 12.8, 4.2],
  ['AURX', 'Aurora Therapeutics', 'Health care', 134.6, 2.9],
  ['GLMR', 'Glimmer Optics', 'Technology', 48.25, 2.5],
  ['HRBR', 'Harborline Shipping', 'Industrials', 29.9, 2.2],
  ['MAPL', 'Maplecrest Bank', 'Financials', 38.4, 1.3],
  ['NBLA', 'Nebula Cloudworks', 'Technology', 312.5, 2.7],
  ['OKEN', 'Oaken Furniture', 'Consumer', 17.35, 1.7],
  ['PLVR', 'Polar Vireo Minerals', 'Materials', 54.8, 2.3],
  ['QRTZ', 'Quartzfield Chips', 'Technology', 188.9, 3.0],
  ['RVNS', 'Ravenstone Insurance', 'Financials', 81.2, 1.1],
  ['SLTW', 'Saltwater Fisheries', 'Consumer', 9.62, 2.0],
  ['TMBR', 'Timberline Paper', 'Materials', 26.7, 1.5],
  ['UMBR', 'Umbra Security Labs', 'Technology', 67.45, 2.9],
  ['VNTG', 'Vantage Rail', 'Industrials', 103.3, 1.4],
  ['WSPR', 'Whisper Audio', 'Technology', 14.9, 3.6],
  ['XPLR', 'Xplorer Outdoor', 'Consumer', 45.6, 1.9],
  ['YRRW', 'Yarrow Organics', 'Consumer', 22.05, 1.6],
  ['ZNTH', 'Zenith Solar Farms', 'Energy', 31.4, 3.2],
  ['ALDR', 'Alder Water Works', 'Utilities', 58.7, 0.8],
  ['BSLT', 'Basalt Cement', 'Materials', 39.95, 1.4],
  ['CNPY', 'Canopy Health Clinics', 'Health care', 27.3, 1.9],
  ['DRFT', 'Driftwood Hotels', 'Real estate', 64.1, 2.1],
  ['EMBR', 'Ember Kitchens', 'Consumer', 18.8, 2.4],
  ['FJRD', 'Fjord Wind Power', 'Energy', 76.55, 2.7],
  ['GRNT', 'Granite Towers REIT', 'Real estate', 92.4, 1.2],
  ['HMNG', 'Hummingbird Drones', 'Industrials', 33.25, 3.8],
  ['IRIS', 'Iris Diagnostics', 'Health care', 115.8, 2.2],
  ['JNPR', 'Juniper Lane Apparel', 'Consumer', 24.6, 1.8],
  ['KELP', 'Kelp & Co. Biomaterials', 'Materials', 11.35, 3.3],
];
export const SYMBOLS = LIST.map(([s]) => s);

// Candles for a timeframe: how many, how far apart, and how much each one moves.
const FRAMES = {
  '1D': { n: 78, label: '5 min' }, // 09:30 to 16:00 in 5-minute candles
  '1W': { n: 35, label: '1 hour' }, // 5 days of 7 hourly candles
  '1M': { n: 22, label: '1 day' }, // 22 trading days
  '1Y': { n: 52, label: '1 week' }, // 52 weeks
};
export const TIMEFRAMES = Object.keys(FRAMES);

/** Weekdays before DAY, newest first: DAY, Thu 22, Wed 21, … */
function tradingDays(count) {
  const out = [];
  for (let d = DAY; out.length < count; d -= 86_400_000) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d);
  }
  return out;
}

/** The time of candle i of n in a timeframe, as an ISO string (exchange time, written as UTC). */
function timeOf(tf, i, n) {
  const back = n - 1 - i; // 0 = the newest candle
  if (tf === '1D') return new Date(DAY + (OPEN_MIN + i * 5) * 60_000).toISOString();
  if (tf === '1W') {
    const day = tradingDays(5)[Math.floor(back / 7)];
    return new Date(day + (OPEN_MIN + (6 - (back % 7)) * 60) * 60_000).toISOString();
  }
  if (tf === '1M') return new Date(tradingDays(n)[back] + OPEN_MIN * 60_000).toISOString();
  return new Date(DAY - 4 * 86_400_000 - back * 7 * 86_400_000 + OPEN_MIN * 60_000).toISOString(); // Mondays
}

const cache = new Map();

/**
 * The candles of one symbol in one timeframe, oldest first. Walked backwards from the last price, so the
 * newest candle closes at it, and the live feed carries on from there.
 */
export function candles(symbol, tf) {
  const key = `${symbol}:${tf}`;
  if (cache.has(key)) return cache.get(key);
  const [, , , last, vol] = LIST.find(([s]) => s === symbol);
  const { n } = FRAMES[tf];
  const rand = random(hash(key));
  // How much one candle moves: the daily volatility scaled to the candle's length.
  const perCandle = { '1D': vol / Math.sqrt(78), '1W': vol / Math.sqrt(7), '1M': vol, '1Y': vol * Math.sqrt(5) }[tf] / 100;
  const baseVolume = Math.round(6_000_000 / Math.sqrt(last)) * { '1D': 1 / 78, '1W': 1 / 7, '1M': 1, '1Y': 5 }[tf];
  const list = [];
  let close = last;
  for (let i = n - 1; i >= 0; i--) {
    const drift = (rand() - 0.5) * 2 * perCandle + (rand() - 0.5) * perCandle * 0.6;
    const open = round2(close / (1 + drift));
    const hi = round2(Math.max(open, close) * (1 + rand() * perCandle * 0.6));
    const lo = round2(Math.min(open, close) * (1 - rand() * perCandle * 0.6));
    // Busier at the open and the close of a day (the U shape), and on big moves.
    const u = tf === '1D' ? 1 + 1.4 * ((i / (n - 1) - 0.5) * 2) ** 2 : 1;
    const v = Math.round(baseVolume * u * (0.6 + rand() * 0.8 + Math.abs(drift) / perCandle / 2));
    list.unshift({ t: timeOf(tf, i, n), o: open, h: hi, l: lo, c: round2(close), v });
    close = open;
  }
  cache.set(key, list);
  return list;
}

/** The instrument list with each one's day so far. */
export function instruments() {
  return LIST.map(([symbol, name, sector, price, vol]) => {
    const day = candles(symbol, '1D');
    const prevClose = candles(symbol, '1M').at(-2).c;
    return {
      symbol, name, sector, price, vol,
      open: day[0].o,
      high: Math.max(...day.map((c) => c.h)),
      low: Math.min(...day.map((c) => c.l)),
      volume: day.reduce((s, c) => s + c.v, 0),
      prevClose,
      spark: day.filter((_, i) => i % 3 === 0).map((c) => c.c),
    };
  });
}

// ---------- The account (in memory, for as long as the dev server runs) ----------

const priceOf = (symbol) => LIST.find(([s]) => s === symbol)?.[3];
let nextOrder = 1000;
const at = (h, m) => new Date(DAY + (h * 60 + m) * 60_000).toISOString();
const account = {
  cash: 18_420.55,
  positions: [
    { symbol: 'NWX', qty: 40, avg: 131.5 },
    { symbol: 'QUIL', qty: 120, avg: 61.2 },
    { symbol: 'TIDL', qty: 300, avg: 18.25 },
    { symbol: 'AURX', qty: 15, avg: 128.9 },
  ],
  orders: [
    { id: `O-${++nextOrder}`, symbol: 'AURX', side: 'buy', type: 'market', qty: 15, limit: null, status: 'filled', fill: 128.9, at: at(9, 41) },
    { id: `O-${++nextOrder}`, symbol: 'QUIL', side: 'sell', type: 'limit', qty: 30, limit: 59.5, status: 'cancelled', fill: null, at: at(10, 12) },
    { id: `O-${++nextOrder}`, symbol: 'HLXB', side: 'buy', type: 'limit', qty: 25, limit: 55, status: 'open', fill: null, at: at(11, 5) },
  ].reverse(),
};

/** Cash not held back by open buy orders. */
const buyingPower = () => round2(account.cash - account.orders
  .filter((o) => o.status === 'open' && o.side === 'buy').reduce((s, o) => s + o.qty * o.limit, 0));
const snapshot = (extra = {}) => structuredClone({ ...account, buyingPower: buyingPower(), ...extra });
const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fill(order, price) {
  const cost = round2(order.qty * price);
  const pos = account.positions.find((p) => p.symbol === order.symbol);
  if (order.side === 'buy') {
    account.cash = round2(account.cash - cost);
    if (pos) {
      pos.avg = round2((pos.avg * pos.qty + cost) / (pos.qty + order.qty));
      pos.qty += order.qty;
    } else account.positions.push({ symbol: order.symbol, qty: order.qty, avg: round2(price) });
  } else {
    account.cash = round2(account.cash + cost);
    pos.qty -= order.qty;
    if (!pos.qty) account.positions = account.positions.filter((p) => p !== pos);
  }
  order.status = 'filled';
  order.fill = round2(price);
}

export async function GET({ query }) {
  if (query.view === 'instruments') {
    await delay(250);
    return { exchange: 'Northwind Markets', day: new Date(DAY).toISOString().slice(0, 10), instruments: instruments() };
  }
  if (query.view === 'account') {
    await delay(200);
    return snapshot();
  }
  await delay(220);
  if (!SYMBOLS.includes(query.symbol)) return Response.json({ message: `There's no symbol "${query.symbol}" on Northwind Markets.` }, { status: 404 });
  const tf = query.tf ?? '1D';
  if (!FRAMES[tf]) return Response.json({ message: `Unknown timeframe: pick ${TIMEFRAMES.join(', ')}` }, { status: 400 });
  return { symbol: query.symbol, tf, every: FRAMES[tf].label, candles: candles(query.symbol, tf) };
}

export async function POST({ body, query }) {
  await delay(500);
  if ('fail' in query) return Response.json({ message: "The exchange didn't answer (500). Your order wasn't placed." }, { status: 500 });
  const { symbol, side, type } = body ?? {};
  const qty = Number(body?.qty);
  const limit = type === 'limit' ? Number(body?.limit) : null;
  const seed = priceOf(symbol);
  if (!seed) return Response.json({ message: `There's no symbol "${symbol}".` }, { status: 422 });
  if (!['buy', 'sell'].includes(side) || !['market', 'limit'].includes(type)) return Response.json({ message: 'An order is a buy or a sell, at market or a limit.' }, { status: 422 });
  if (!Number.isInteger(qty) || qty < 1 || qty > 100_000) return Response.json({ message: 'Check the order', errors: { qty: 'Whole shares, from 1 to 100,000' } }, { status: 422 });
  if (type === 'limit' && !(limit > 0)) return Response.json({ message: 'Check the order', errors: { limit: 'Enter a limit price' } }, { status: 422 });
  // The live price comes from the browser's feed; the server only checks it's near the symbol's price.
  const price = Number(body?.price);
  if (!(price > seed * 0.5 && price < seed * 1.5)) return Response.json({ message: 'The price moved too far. Try again.' }, { status: 422 });

  if (side === 'buy') {
    const cost = round2(qty * (limit ?? price));
    const power = buyingPower();
    if (cost > power) {
      return Response.json({ message: `Not enough buying power: this order needs ${money(cost)} and you have ${money(power)}.` }, { status: 422 });
    }
  } else {
    const held = account.positions.find((p) => p.symbol === symbol)?.qty ?? 0;
    const selling = account.orders.filter((o) => o.status === 'open' && o.side === 'sell' && o.symbol === symbol).reduce((s, o) => s + o.qty, 0);
    if (qty > held - selling) {
      const free = held - selling;
      return Response.json({ message: 'Check the order', errors: { qty: free > 0 ? `You can sell up to ${free} ${symbol}` : `You don't hold any ${symbol} to sell` } }, { status: 422 });
    }
  }

  const order = { id: `O-${++nextOrder}`, symbol, side, type, qty, limit, status: 'open', fill: null, at: new Date().toISOString() };
  account.orders.unshift(order);
  // A market order fills now. A limit order fills now if the price is already at or better than it; else it waits.
  if (type === 'market' || (side === 'buy' ? limit >= price : limit <= price)) fill(order, price);
  return snapshot({ last: order });
}

export async function DELETE({ query }) {
  await delay(300);
  const order = account.orders.find((o) => o.id === query.id);
  if (!order) return Response.json({ message: 'There is no such order.' }, { status: 404 });
  if (order.status !== 'open') return Response.json({ message: `This order is already ${order.status}.` }, { status: 409 });
  order.status = 'cancelled';
  return snapshot({ last: order });
}
