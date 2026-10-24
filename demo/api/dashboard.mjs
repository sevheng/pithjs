// GET /api/dashboard?range=30 → { range, days, kpis, revenue, channels } for the last `range` days (7, 30 or 90),
//     each KPI with its value for the previous period of the same length.
// GET /api/dashboard?view=orders&range=30&page=1&sort=date&dir=desc&status=paid&q=ann
//     → { items, total, page, pages, pageSize, counts } (10 a page; counts per status for the current search).
// ?range=fail answers 500 for both, so the error state (and Try again) can be seen.
// Dev-only demo data for "Fern & Field", a small online shop. It's generated once from a fixed seed and a
// fixed last day (not from "now"), so every run, test and screenshot sees the same numbers.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const LAST_DAY = Date.UTC(2026, 9, 23); // 23 Oct 2026, the newest day of data
const HISTORY = 180; // days: enough for 90 days plus the 90 before them
const DAY = 86_400_000;
const PAGE_SIZE = 10;
export const RANGES = [7, 30, 90];

// mulberry32: a tiny seeded random number generator, so the data is the same on every run.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CHANNELS = ['Online store', 'Instagram', 'Google Ads', 'Email', 'Marketplace'];
const CHANNEL_WEIGHTS = [0.42, 0.21, 0.16, 0.13, 0.08];
export const STATUSES = ['paid', 'shipped', 'pending', 'refunded'];
const PRODUCTS = [
  ['Linen tote', 38], ['Ceramic mug', 24], ['Beeswax candle', 18], ['Wool throw', 120], ['Olive wood board', 46],
  ['Notebook set', 16], ['Terracotta pot', 32], ['Tea sampler', 22], ['Cotton apron', 34], ['Brass bookends', 68],
];
const FIRST = ['Ann', 'Ben', 'Chloe', 'Dev', 'Elena', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jade', 'Kofi', 'Lena', 'Marco', 'Nia',
  'Omar', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tess', 'Uma', 'Victor', 'Wren', 'Yusuf', 'Zoe'];
const LAST = ['Adams', 'Brooks', 'Castillo', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jensen', 'Kim',
  'Lopez', 'Moreau', 'Novak', 'Okafor', 'Patel', 'Rossi', 'Schmidt', 'Tanaka', 'Weber'];
const CITIES = ['Portland, OR', 'Austin, TX', 'Denver, CO', 'Chicago, IL', 'Brooklyn, NY', 'Oakland, CA', 'Seattle, WA',
  'Madison, WI', 'Asheville, NC', 'Tucson, AZ'];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const weighted = (rand, weights) => {
  let r = rand();
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
  return weights.length - 1;
};
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

// Daily sessions and every order of the last HISTORY days, oldest first.
const days = [];
const orders = [];
{
  const rand = random(20261023);
  let id = 10_000;
  for (let d = HISTORY - 1; d >= 0; d--) {
    const ms = LAST_DAY - d * DAY;
    const weekday = new Date(ms).getUTCDay();
    const growth = 1 + (HISTORY - d) / HISTORY / 3; // the shop grows about a third over the half year
    const weekend = weekday === 0 || weekday === 6 ? 1.22 : 1;
    const sessions = Math.round(820 * growth * weekend * (0.85 + rand() * 0.3));
    const rate = 0.024 + rand() * 0.01 + (weekday === 1 ? 0.004 : 0); // Mondays convert a little better (an email goes out)
    const count = Math.max(1, Math.round(sessions * rate));
    const day = { date: iso(ms), sessions, orders: count, revenue: 0 };
    for (let n = 0; n < count; n++) {
      const first = pick(rand, FIRST);
      const last = pick(rand, LAST);
      const items = [];
      const lines = 1 + weighted(rand, [0.55, 0.3, 0.15]);
      for (let l = 0; l < lines; l++) {
        const [name, price] = pick(rand, PRODUCTS);
        const qty = 1 + weighted(rand, [0.8, 0.15, 0.05]);
        const same = items.find((i) => i.name === name);
        if (same) same.qty += qty;
        else items.push({ name, price, qty });
      }
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const shipping = subtotal >= 75 ? 0 : 6;
      // New orders are mostly still pending; older ones have shipped. A few get refunded.
      const status = rand() < 0.035 ? 'refunded' : d <= 1 ? (rand() < 0.7 ? 'pending' : 'paid') : d <= 4 ? (rand() < 0.5 ? 'paid' : 'shipped') : 'shipped';
      const total = subtotal + shipping;
      if (status !== 'refunded') day.revenue += total;
      orders.push({
        id: String(++id),
        date: iso(ms),
        customer: `${first} ${last}`,
        email: `${first}.${last}`.toLowerCase() + '@example.com',
        city: pick(rand, CITIES),
        channel: CHANNELS[weighted(rand, CHANNEL_WEIGHTS)],
        status,
        items,
        subtotal,
        shipping,
        total,
      });
    }
    days.push(day);
  }
}

/** The days of the range ending at offset (0 = the newest `range` days, `range` = the period before). */
const span = (range, offset) => days.slice(HISTORY - offset - range, HISTORY - offset);
const ordersIn = (from, to) => orders.filter((o) => o.date >= from && o.date <= to);

function totals(list) {
  const revenue = list.reduce((s, d) => s + d.revenue, 0);
  const count = list.reduce((s, d) => s + d.orders, 0);
  const sessions = list.reduce((s, d) => s + d.sessions, 0);
  return { revenue, orders: count, conversion: (count / sessions) * 100, aov: revenue / count };
}

/** The dashboard's summary for the last `range` days. */
export function summary(range) {
  const current = span(range, 0);
  const previous = span(range, range);
  const now = totals(current);
  const before = totals(previous);
  const list = ordersIn(current[0].date, current.at(-1).date);
  return {
    range,
    from: current[0].date,
    to: current.at(-1).date,
    kpis: Object.fromEntries(Object.keys(now).map((k) => [k, { value: now[k], previous: before[k] }])),
    revenue: current.map((d) => ({ date: d.date, value: d.revenue })),
    channels: CHANNELS.map((name) => ({ name, orders: list.filter((o) => o.channel === name).length })),
  };
}

const SORTS = {
  date: (a, b) => a.date.localeCompare(b.date) || Number(a.id) - Number(b.id),
  customer: (a, b) => a.customer.localeCompare(b.customer) || Number(a.id) - Number(b.id),
  total: (a, b) => a.total - b.total || Number(a.id) - Number(b.id),
  status: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || Number(b.id) - Number(a.id),
};

/** One page of the range's orders, searched, filtered and sorted. */
export function orderPage(range, { page = 1, sort = 'date', dir = 'desc', status = '', q = '' } = {}) {
  const current = span(range, 0);
  const needle = q.trim().toLowerCase();
  const searched = ordersIn(current[0].date, current.at(-1).date)
    .filter((o) => !needle || o.customer.toLowerCase().includes(needle) || o.id.includes(needle.replace(/^#/, '')));
  const counts = Object.fromEntries(STATUSES.map((s) => [s, searched.filter((o) => o.status === s).length]));
  counts.all = searched.length;
  const filtered = STATUSES.includes(status) ? searched.filter((o) => o.status === status) : searched;
  const compare = SORTS[sort] ?? SORTS.date;
  const sorted = filtered.toSorted((a, b) => (dir === 'asc' ? compare(a, b) : -compare(a, b)));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const at = Math.min(pages, Math.max(1, Number.parseInt(page, 10) || 1));
  return { items: sorted.slice((at - 1) * PAGE_SIZE, at * PAGE_SIZE), total: sorted.length, page: at, pages, pageSize: PAGE_SIZE, counts };
}

export async function GET({ query }) {
  await delay(query.view === 'orders' ? 250 : 350);
  if (query.range === 'fail') return Response.json({ message: 'The analytics service is not answering (500).' }, { status: 500 });
  const range = Number(query.range ?? 30);
  if (!RANGES.includes(range)) return Response.json({ message: `Unknown range: pick ${RANGES.join(', ')} days` }, { status: 400 });
  if (query.view === 'orders') return orderPage(range, query);
  return summary(range);
}
