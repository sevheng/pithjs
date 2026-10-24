import { html, signal, computed, effect, resource, fetchJSON, repeat, selector, untrack, onCleanup, transition } from 'pith';
import { router } from '../router.js';
import { icon } from '../icons.js';
import { revenueChart, channelChart } from '../dashboard/charts.js';
import { money, cents, count, day, fullDay } from '../dashboard/format.js';

// An analytics view for a small shop. Everything it shows is kept in the URL: the range (?range=7|30|90),
// and the orders table's sort, direction, status filter, search and page. The fetchers read those, so a
// change refetches what depends on it (and cancels the request it replaces). ?range=fail answers 500.

const RANGES = [['7', '7 days'], ['30', '30 days'], ['90', '90 days']];
const STATUSES = [['', 'All'], ['paid', 'Paid'], ['shipped', 'Shipped'], ['pending', 'Pending'], ['refunded', 'Refunded']];
const STATUS_NAMES = Object.fromEntries(STATUSES);
const COLUMNS = [
  { label: 'Order' },
  { label: 'Date', sort: 'date', first: 'desc' },
  { label: 'Customer', sort: 'customer', first: 'asc' },
  { label: 'Channel' },
  { label: 'Status', sort: 'status', first: 'asc' },
  { label: 'Total', sort: 'total', first: 'desc', num: true },
];
const KPIS = [
  { key: 'revenue', label: 'Revenue', show: (/** @type {number} */ v) => money(v) },
  { key: 'orders', label: 'Orders', show: (/** @type {number} */ v) => count(v) },
  { key: 'conversion', label: 'Conversion rate', points: true, show: (/** @type {number} */ v) => html`${v.toFixed(2)}<small>%</small>` },
  { key: 'aov', label: 'Average order value', show: (/** @type {number} */ v) => cents(v) },
];

/** @typedef {{ id: string, date: string, customer: string, email: string, city: string, channel: string, status: string,
 *   items: { name: string, price: number, qty: number }[], subtotal: number, shipping: number, total: number }} Order */

export default function DashboardPage() {
  const q = () => router.query.value;
  const range = computed(() => q().range ?? '30');
  const sort = computed(() => q().sort ?? 'date');
  const dir = computed(() => q().dir ?? COLUMNS.find((c) => c.sort === sort.value)?.first ?? 'desc');
  const status = computed(() => q().status ?? '');
  const search = computed(() => q().q ?? '');
  const needle = computed(() => search.value.trim());
  const page = computed(() => Number(q().page) || 1);
  const period = computed(() => `the last ${range.value} days`);

  const summary = resource(({ signal }) => fetchJSON(`/api/dashboard?range=${encodeURIComponent(range.value)}`, { signal }));
  const orders = resource(({ signal }) => {
    const params = new URLSearchParams({ view: 'orders', range: range.value, page: String(page.value), sort: sort.value, dir: dir.value });
    if (status.value) params.set('status', status.value);
    if (needle.value) params.set('q', needle.value);
    return fetchJSON(`/api/dashboard?${params}`, { signal });
  });

  // "Updated just now": when the numbers last arrived, against a clock that ticks every 15 seconds.
  const updatedAt = signal(0);
  const now = signal(Date.now());
  const ticker = setInterval(() => (now.value = Date.now()), 15_000);
  onCleanup(() => clearInterval(ticker));
  effect(() => {
    if (summary.data.value) untrack(() => (updatedAt.value = now.value = Date.now()));
  });
  const busy = computed(() => summary.loading.value || orders.loading.value);
  const updated = computed(() => {
    if (busy.value) return 'Updating…';
    if (!updatedAt.value || summary.status.value === 'error') return '';
    const minutes = Math.floor((now.value - updatedAt.value) / 60_000);
    return minutes < 1 ? 'Updated just now' : `Updated ${minutes} min ago`;
  });
  const refresh = () => { summary.refetch(); orders.refetch(); };

  // The selected order, shown in the side panel. It's the row's own data, so paging away keeps it open.
  const current = signal(/** @type {Order | null} */ (null));
  const isSelected = selector(() => current.value?.id);
  /** @type {HTMLElement | null} */
  let opener = null; // the row's button, to return focus to when the panel closes
  effect(() => {
    range.value; // a new range is a different set of orders
    untrack(() => (current.value = null));
  });
  // Opening and closing the panel animate (class="motion" on the layout: the table makes room); moving from one
  // order to another while it's open doesn't.
  const close = () => transition(() => {
    current.value = null;
    opener?.focus();
  });
  /** @param {Order} o @param {Event} e */
  const open = (o, e) => {
    opener = /** @type {HTMLElement} */ (e.currentTarget).querySelector('button');
    if (current.value) current.value = o;
    else transition(() => (current.value = o));
  };

  /** Change the table's query; anything but a page change starts again at page 1. */
  const setTable = (/** @type {Record<string, string | null>} */ change) => router.setQuery({ page: null, ...change });
  const sortBy = (/** @type {typeof COLUMNS[number]} */ c) => {
    const next = sort.value === c.sort ? (dir.value === 'asc' ? 'desc' : 'asc') : c.first;
    setTable({ sort: c.sort === 'date' ? null : c.sort ?? null, dir: next === c.first ? null : next ?? null });
  };
  const clearFilters = () => setTable({ status: null, q: null });

  // ---------- KPIs and charts ----------
  /** @param {typeof KPIS[number]} k @param {any} data */
  const kpi = (k, data) => {
    const { value, previous } = data.kpis[k.key];
    const change = k.points ? value - previous : ((value - previous) / previous) * 100;
    const way = Math.abs(change) < 0.05 ? 'flat' : change > 0 ? 'up' : 'down';
    const amount = k.points ? `${Math.abs(change).toFixed(2)} pts` : `${Math.abs(change).toFixed(1)}%`;
    return html`
      <article class="card kpi" data-kpi=${k.key}>
        <h3 class="kpi-label">${k.label}</h3>
        <p class="value">${k.show(value)}</p>
        <p class="kpi-trend">
          <span class=${`trend ${way}`}>${icon(`trend-${way}`)}${way === 'flat' ? 'No change' : `${way === 'up' ? 'Up' : 'Down'} ${amount}`}</span>
          <span class="muted">vs the ${data.range} days before</span>
        </p>
      </article>`;
  };

  const overviewSkeleton = () => html`
    <div class="kpi-grid">${KPIS.map(() => html`<div class="card kpi"><span class="dash-skel line short"></span><span class="dash-skel big"></span><span class="dash-skel line"></span></div>`)}</div>
    <div class="chart-row">
      <div class="card chart-card chart-wide"><span class="dash-skel line short"></span><span class="dash-skel chart-skel line-skel"></span></div>
      <div class="card chart-card"><span class="dash-skel line short"></span><span class="dash-skel chart-skel bar-skel"></span></div>
    </div>
    <p class="sr-only" role="status">Loading the numbers…</p>`;

  // render(): a new range or a refresh draws the numbers again.
  const overview = summary.render({
    loading: overviewSkeleton,
    error: (err, retry) => html`<div class="load-error dash-error" role="alert">
        <p><strong>Couldn't load the numbers.</strong> ${err?.message ?? ''}</p>
        <div class="row"><button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button>
          ${range.value in { 7: 1, 30: 1, 90: 1 } ? null : html`<a class="btn ghost" href="/dashboard">Show the last 30 days</a>`}</div>
      </div>`,
    ready: (/** @type {any} */ data) => html`
      <div class="kpi-grid">${KPIS.map((k) => kpi(k, data))}</div>
      <div class="chart-row">${revenueChart(data.revenue, `the last ${data.range} days`)}${channelChart(data.channels, `the last ${data.range} days`)}</div>`,
  });

  // ---------- Orders ----------
  const items = computed(() => /** @type {Order[]} */ (orders.data.value?.items ?? []));
  const empty = computed(() => !items.value.length);

  const pill = (/** @type {string} */ s) => html`<span class=${`status-pill ${s}`}>${STATUS_NAMES[s]}</span>`;

  /** @param {Order} o */
  const row = (o) => html`
    <tr class=${() => (isSelected(o.id) ? 'selected' : null)} @click=${(/** @type {Event} */ e) => open(o, e)}>
      <td><button class="order-link" type="button" aria-label=${`Open order ${o.id}`} aria-current=${() => (isSelected(o.id) ? 'true' : null)}>#${o.id}</button></td>
      <td class="nowrap">${day(o.date)}</td>
      <td>${o.customer}</td>
      <td class="nowrap">${o.channel}</td>
      <td>${pill(o.status)}</td>
      <td class="num">${cents(o.total)}</td>
    </tr>`;

  const head = () => html`
    <thead><tr>${COLUMNS.map((c) => html`
      <th scope="col" class=${c.num ? 'num' : null}
          aria-sort=${c.sort ? () => (sort.value !== c.sort ? 'none' : dir.value === 'asc' ? 'ascending' : 'descending') : null}>
        ${c.sort
          ? html`<button class="sort" type="button" @click=${() => sortBy(c)}>${c.label}</button>`
          : c.label}
      </th>`)}</tr></thead>`;

  const pager = () => html`
    <div class="pager-bar">
      <p class="muted note" aria-live="polite">${() => {
        const d = orders.data.value;
        if (!d?.total) return '';
        const from = (d.page - 1) * d.pageSize + 1;
        return `Showing ${count(from)}–${count(Math.min(d.total, from + d.pageSize - 1))} of ${count(d.total)}`;
      }}</p>
      <div class="pager-buttons">
        <button class="btn" type="button" ?disabled=${() => (orders.data.value?.page ?? 1) <= 1}
                @click=${() => router.setQuery({ page: String(orders.data.value.page - 1) === '1' ? null : String(orders.data.value.page - 1) })}>${icon('back')} Previous</button>
        <span class="small pager-at">${() => `Page ${orders.data.value?.page ?? 1} of ${orders.data.value?.pages ?? 1}`}</span>
        <button class="btn" type="button" ?disabled=${() => (orders.data.value?.page ?? 1) >= (orders.data.value?.pages ?? 1)}
                @click=${() => router.setQuery({ page: String(orders.data.value.page + 1) })}>Next ${icon('next')}</button>
      </div>
    </div>`;

  const table = (/** @type {boolean} */ loading) => html`
    <div class="table-box" role="region" aria-label="Orders" tabindex="0">
      <table class="orders-table">
        <caption class="sr-only">${() => `Orders in ${period.value}, sorted by ${sort.value}, ${dir.value === 'asc' ? 'ascending' : 'descending'}`}</caption>
        ${head()}
        ${loading
          ? html`<tbody>${Array.from({ length: 10 }, () => html`<tr class="skeleton-row"><td colspan="6"><span class="dash-skel line"></span></td></tr>`)}</tbody>`
          : html`<tbody>${repeat(items, (o) => o.id, row)}</tbody>`}
      </table>
    </div>
    ${loading ? html`<p class="sr-only" role="status">Loading orders…</p>` : pager()}`;

  const noOrders = () => html`<div class="orders-empty">
    <span class="icon-tile">${icon('search')}</span>
    <p><strong>No orders match.</strong></p>
    <p class="muted">${() => `Nothing ${status.value ? `${STATUS_NAMES[status.value].toLowerCase()} ` : ''}${needle.value ? `for “${needle.value}” ` : ''}in ${period.value}.`}</p>
    <button class="btn" type="button" @click=${clearFilters}>Clear filters</button>
  </div>`;

  // live(): the table is built once and patched as pages, sorts and filters arrive; only an empty result swaps it.
  const tableView = orders.live({
    loading: () => table(true),
    error: (err, retry) => html`<div class="load-error" role="alert"><p><strong>Couldn't load the orders.</strong> ${err?.message ?? ''}</p>
      <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`,
    ready: () => html`${() => (empty.value ? untrack(noOrders) : untrack(() => table(false)))}`,
  });

  /** @param {Order} o */
  const panel = (o) => html`
    <aside class="order-panel card" aria-labelledby="order-title" @keydown=${(/** @type {KeyboardEvent} */ e) => e.key === 'Escape' && close()}>
      <header class="order-panel-head">
        <div>
          <p class="muted note">${fullDay(o.date)}</p>
          <h3 id="order-title" tabindex="-1" ref=${(/** @type {HTMLElement} */ el) => requestAnimationFrame(() => el.focus({ preventScroll: true }))}>Order #${o.id}</h3>
        </div>
        <button class="icon-btn" type="button" aria-label="Close order details" @click=${close}>${icon('close')}</button>
      </header>
      ${pill(o.status)}
      <dl class="order-facts">
        <div><dt>Customer</dt><dd>${o.customer}<span class="muted note">${o.email}</span></dd></div>
        <div><dt>Ship to</dt><dd>${o.city}</dd></div>
        <div><dt>Channel</dt><dd>${o.channel}</dd></div>
      </dl>
      <h4 class="order-items-title">Items</h4>
      <ul class="order-items">${o.items.map((i) => html`<li><span>${i.qty} × ${i.name}</span><span>${cents(i.price * i.qty)}</span></li>`)}</ul>
      <dl class="order-sum">
        <div><dt>Subtotal</dt><dd>${cents(o.subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>${o.shipping ? cents(o.shipping) : 'Free'}</dd></div>
        <div class="grand"><dt>Total</dt><dd>${cents(o.total)}</dd></div>
      </dl>
    </aside>`;

  return html`
    <div class="dashboard">
      <header class="dash-head">
        <div>
          <p class="eyebrow">Fern &amp; Field · online shop</p>
          <h1>Dashboard</h1>
          <p class="muted">${() => {
            const d = summary.data.value;
            return d && summary.status.value === 'ready' ? `${fullDay(d.from)} – ${fullDay(d.to)}` : ' ';
          }}</p>
        </div>
        <div class="dash-tools">
          <div class="segmented" role="group" aria-label="Date range">
            ${RANGES.map(([r, label]) => html`<button type="button" aria-pressed=${() => String(range.value === r)}
              @click=${() => router.setQuery({ range: r === '30' ? null : r, page: null })}>${label}</button>`)}
          </div>
          <button class="btn" type="button" @click=${refresh} ?disabled=${busy}>${icon('refresh')} Refresh</button>
          <p class="muted note updated" aria-live="polite">${updated}</p>
        </div>
      </header>

      <section class="overview" aria-labelledby="overview-title" aria-busy=${() => String(summary.loading.value)}
               data-busy=${() => (summary.loading.value && summary.status.value === 'ready' ? 'true' : null)}>
        <h2 id="overview-title" class="sr-only">Key numbers</h2>
        ${overview}
      </section>

      <section class="section orders" aria-labelledby="orders-title">
        <div class="orders-head">
          <h2 id="orders-title">Orders</h2>
          <p class="muted note">${() => (orders.data.value ? `${count(orders.data.value.counts.all)} in ${period.value}${needle.value ? ` for “${needle.value}”` : ''}` : '')}</p>
        </div>
        <div class="orders-tools">
          <div class="search-field">
            <label class="sr-only" for="order-search">Search orders by customer</label>
            ${icon('search')}
            <input id="order-search" class="input" type="search" placeholder="Customer or order number" autocomplete="off"
                   .value=${search}
                   @input=${(/** @type {Event} */ e) => setTable({ q: /** @type {HTMLInputElement} */ (e.target).value || null })}>
          </div>
          <div class="status-chips" role="group" aria-label="Filter by status">
            ${STATUSES.map(([s, label]) => html`<button type="button" class="chip" data-status=${s || 'all'}
              aria-pressed=${() => String(status.value === s)}
              aria-label=${() => { const n = orders.data.value?.counts?.[s || 'all']; return n === undefined ? label : `${label}, ${count(n)} orders`; }}
              @click=${() => setTable({ status: s || null })}>
              ${label}<span class="chip-count" aria-hidden="true">${() => { const n = orders.data.value?.counts?.[s || 'all']; return n === undefined ? '' : count(n); }}</span>
            </button>`)}
          </div>
        </div>
        <div class="orders-layout motion" data-panel=${() => (current.value ? 'open' : null)}>
          <div class="orders-main" data-busy=${() => (orders.loading.value && orders.status.value === 'ready' ? 'true' : null)}>
            ${tableView}
          </div>
          ${() => {
            const o = current.value;
            return o ? untrack(() => panel(o)) : null;
          }}
        </div>
      </section>

      <p class="muted note dash-foot">Demo data for a made-up shop, the same on every visit. To see the error state,
        <a href="/dashboard?range=fail">open the dashboard with <code>?range=fail</code></a>.</p>
    </div>
  `;
}
