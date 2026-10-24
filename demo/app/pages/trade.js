import { html, signal, computed, effect, batch, resource, fetchJSON, repeat, untrack, onCleanup, transition, form, rules } from 'pith';
import { router } from '../router.js';
import { confirm, toast } from '../ui.js';
import { icon } from '../icons.js';
import { market, account, TIMEFRAMES, DEFAULT_SYMBOL } from '../trade/state.js';
import { candleChart, CHART_H } from '../trade/chart.js';
import { price, percent, signed, signedMoney, cents, count, volume, way, clock } from '../trade/format.js';

/** @typedef {import('../trade/feed.js').Quote} Quote */
/** @typedef {{ id: string, symbol: string, side: 'buy' | 'sell', type: 'market' | 'limit', qty: number, limit: number | null,
 *   status: 'pending' | 'open' | 'filled' | 'cancelled' | 'cancelling' | 'failed', fill: number | null, at: string, error?: string }} Order */

const TF_NAMES = { '1D': 'Today, 5-minute candles', '1W': 'This week, hourly candles', '1M': 'One month, daily candles', '1Y': 'One year, weekly candles' };
const SAY_EVERY = 5000; // a screen reader hears the price at most this often, not on every tick

/** Run a change as a transition() (class="motion" animates it), and wait for what it returns. */
const animated = (/** @type {() => Promise<any>} */ fn) => new Promise((resolve, reject) => transition(() => fn().then(resolve, reject)));

/** @param {{ symbol: string }} params */
export default function TradePage({ symbol }) {
  const feed = market.peek();
  const acct = account.current;
  if (!feed || !acct) return html`<h1>${symbol}</h1>`; // only without the trade layout
  const loaded = computed(() => feed.quotes.value.length > 0);

  const skeleton = () => html`
    <div class="trade-center">
      <header class="quote-head card">
        <div class="quote-id"><p class="eyebrow">Northwind Markets</p><h1><span class="quote-sym">${symbol}</span></h1></div>
        <span class="trade-skel big"></span>
      </header>
      <div class="card trade-chart"><span class="trade-skel" style=${`height: ${CHART_H}px`}></span></div>
    </div>
    <div class="trade-side"><div class="card"><span class="trade-skel tall"></span></div></div>
    <p class="sr-only" role="status">Loading ${symbol}…</p>`;

  const missing = () => html`
    <section class="trade-center trade-missing card">
      <span class="icon-tile">${icon('search')}</span>
      <h1>No such symbol</h1>
      <p class="muted">There's no “${symbol}” on Northwind Markets. Pick one from the watchlist, or:</p>
      <a class="btn primary" href=${`/trade/${DEFAULT_SYMBOL}`}>Go to ${DEFAULT_SYMBOL}</a>
    </section>`;

  return html`${() => {
    if (!loaded.value) return untrack(skeleton);
    const q = feed.get(symbol);
    return untrack(() => (q ? symbolView(q) : missing()));
  }}`;

  /** @param {Quote} q */
  function symbolView(q) {
    feed.focus.value = symbol;
    onCleanup(() => {
      if (feed.focus.peek() === symbol) feed.focus.value = null;
    });
    const change = computed(() => q.price.value - q.prevClose);
    const changePct = computed(() => (change.value / q.prevClose) * 100);

    // ---------- What a screen reader hears: the price, at most every 5 seconds ----------
    const said = signal('');
    let lastSaid = 0;
    /** @type {ReturnType<typeof setTimeout> | 0} */
    let sayTimer = 0;
    effect(() => {
      q.price.value;
      untrack(() => {
        if (sayTimer) return;
        sayTimer = setTimeout(() => {
          sayTimer = 0;
          lastSaid = Date.now();
          said.value = `${symbol} ${price(q.price.peek())}, ${changePct.peek() >= 0 ? 'up' : 'down'} ${percent(Math.abs(changePct.peek()))} today`;
        }, Math.max(0, SAY_EVERY - (Date.now() - lastSaid)));
      });
    });
    onCleanup(() => clearTimeout(sayTimer));

    // ---------- The chart ----------
    const tf = computed(() => (TIMEFRAMES.includes(router.query.value.tf) ? router.query.value.tf : '1D'));
    const candles = resource(({ signal: abort }) =>
      fetchJSON(`/api/trade?symbol=${encodeURIComponent(symbol)}&tf=${tf.value}`, { signal: abort }));
    const chartView = candles.render({
      loading: () => html`<span class="trade-skel chart-skel" style=${`height: ${CHART_H + 44}px`}></span><p class="sr-only" role="status">Loading the chart…</p>`,
      error: (err, retry) => html`<div class="load-error chart-error" role="alert" style=${`min-height: ${CHART_H}px`}>
        <p><strong>Couldn't load the chart.</strong> ${err?.message ?? ''}</p>
        <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`,
      ready: (/** @type {any} */ data) => candleChart(data, q),
    });

    // ---------- The order book: 10 levels a side, each a row of signals moved in place ----------
    const inc = q.base < 20 ? 0.01 : q.base < 100 ? 0.02 : 0.05;
    let seed = [...symbol].reduce((h, c) => h * 31 + c.charCodeAt(0), 11) % 2147483647;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const level = () => ({ price: signal(0), size: signal(0), total: signal(0), depth: signal(0) });
    const asks = Array.from({ length: 10 }, level);
    const bids = Array.from({ length: 10 }, level);
    const lots = { asks: asks.map(() => 0), bids: bids.map(() => 0) };
    const lot = (/** @type {number} */ i) => Math.round((2 + rand() * 18 + i * 3) * (q.base < 50 ? 50 : 10)) * 10;
    lots.asks = lots.asks.map((_, i) => lot(i));
    lots.bids = lots.bids.map((_, i) => lot(i));
    const book = (/** @type {number} */ p) => {
      // A few levels change size on each tick; the rest keep theirs.
      for (let k = 0; k < 3; k++) {
        const side = rand() < 0.5 ? lots.asks : lots.bids;
        const i = Math.floor(rand() * 10);
        side[i] = lot(i);
      }
      let a = 0;
      let b = 0;
      const aTotals = lots.asks.map((s) => (a += s));
      const bTotals = lots.bids.map((s) => (b += s));
      const most = Math.max(a, b);
      batch(() => {
        asks.forEach((l, i) => {
          l.price.value = Math.round((p + inc * (i + 1)) * 100) / 100;
          l.size.value = lots.asks[i];
          l.total.value = aTotals[i];
          l.depth.value = aTotals[i] / most;
        });
        bids.forEach((l, i) => {
          l.price.value = Math.round((p - inc * i) * 100) / 100;
          l.size.value = lots.bids[i];
          l.total.value = bTotals[i];
          l.depth.value = bTotals[i] / most;
        });
      });
    };
    effect(() => {
      const p = q.price.value;
      untrack(() => book(p));
    });
    const levelRow = (/** @type {ReturnType<typeof level>} */ l, /** @type {string} */ side) => html`
      <li class=${`book-row ${side}`} style=${() => `--depth: ${(l.depth.value * 100).toFixed(1)}%`}>
        <span class="book-price">${() => price(l.price.value)}</span><span>${() => count(l.size.value)}</span><span class="muted">${() => count(l.total.value)}</span>
      </li>`;

    // ---------- Trades: the newest 12, keyed by id, so a new one is one row added ----------
    const trades = signal(/** @type {import('../trade/feed.js').Trade[]} */ ([]));
    effect(() => {
      const t = q.trade.value;
      if (t) untrack(() => (trades.value = [t, ...trades.value.slice(0, 11)]));
    });
    const tradeRow = (/** @type {import('../trade/feed.js').Trade} */ t) => html`
      <li class=${`tape-row ${t.side === 'buy' ? 'up' : 'down'}`}>
        <span class="muted">${clock(t.at)}</span>
        <span class="tape-price"><span aria-hidden="true">${t.side === 'buy' ? '▲' : '▼'}</span>${price(t.price)}<span class="sr-only">${t.side === 'buy' ? ', up' : ', down'}</span></span>
        <span>${count(t.size)}</span>
      </li>`;

    // ---------- The order ticket ----------
    const lastOrder = signal(/** @type {Order | null} */ (null));
    const failed = signal(/** @type {Order[]} */ ([]));
    let temp = 0;
    const wholeShares = (/** @type {string} */ v) => (!/^\s*\d+\s*$/.test(String(v)) || Number(v) < 1 ? 'Whole shares, at least 1' : Number(v) > 100_000 ? 'At most 100,000 shares an order' : null);
    const limitRule = (/** @type {string} */ v, /** @type {any} */ all) => (all.type !== 'limit' ? null : !(Number(v) > 0) ? 'Enter the most you’ll pay (or the least you’ll take)' : null);
    const ticket = form({
      initial: { side: 'buy', type: 'market', qty: '10', limit: '' },
      validate: { qty: [rules.required('Enter how many shares'), wholeShares], limit: limitRule },
      onSubmit: (v) => place({ symbol, side: /** @type {'buy' | 'sell'} */ (v.side), type: /** @type {'market' | 'limit'} */ (v.type),
        qty: Number(v.qty), limit: v.type === 'limit' ? Number(v.limit) : null }),
    });
    const f = ticket.fields;
    const shares = computed(() => (wholeShares(f.qty.value) ? 0 : Number(f.qty.value)));
    const at = computed(() => (f.type.value === 'limit' ? Number(f.limit.value) || 0 : q.price.value));
    const cost = computed(() => shares.value * at.value);
    const power = computed(() => acct.data.value?.buyingPower ?? 0);
    const held = computed(() => acct.data.value?.positions.find((/** @type {any} */ p) => p.symbol === symbol)?.qty ?? 0);
    const over = computed(() => f.side.value === 'buy' && cost.value > power.value);
    const setType = (/** @type {string} */ t) => {
      if (t === 'limit' && !f.limit.peek()) ticket.set('limit', price(q.price.peek()).replace(/,/g, ''));
      ticket.set('type', t);
    };
    const describe = (/** @type {{ side: string, qty: number, type: string, limit: number | null }} */ o) =>
      `${o.side === 'buy' ? 'Buy' : 'Sell'} ${count(o.qty)} ${symbol}${o.type === 'limit' ? ` at ${cents(/** @type {number} */ (o.limit))}` : ' at market'}`;

    /** Place an order: Pending at once (optimistic), then the server's answer replaces it. */
    async function place(/** @type {Omit<Order, 'id' | 'status' | 'fill' | 'at'>} */ order) {
      const pending = /** @type {Order} */ ({ ...order, id: `temp-${++temp}`, status: 'pending', fill: null, at: new Date().toISOString() });
      lastOrder.value = pending;
      const fail = 'fail' in router.query.peek() || router.query.peek().order === 'fail';
      try {
        const saved = await animated(() => acct.optimistic(
          (/** @type {any} */ a) => ({ ...a, orders: [pending, ...a.orders] }),
          () => fetchJSON(`/api/trade${fail ? '?fail' : ''}`, { json: { ...order, price: q.price.peek() } })
        ));
        const o = /** @type {Order} */ (saved.last);
        lastOrder.value = o;
        toast(o.status === 'filled'
          ? `${o.side === 'buy' ? 'Bought' : 'Sold'} ${count(o.qty)} ${o.symbol} at ${cents(/** @type {number} */ (o.fill))}`
          : `Order placed: ${describe(o)}. It waits until the price gets there.`, { type: 'success' });
      } catch (/** @type {any} */ err) {
        lastOrder.value = null;
        if (err?.status === 422) throw err; // a field error or "Not enough buying power": shown in the form
        // Anything else (the exchange is down): the order comes back in Orders with Retry.
        transition(() => (failed.value = [{ ...pending, status: 'failed', error: err?.message ?? String(err) }, ...failed.value]));
        tab.value = 'orders';
        toast(`Couldn't place the order: ${err?.message ?? err}`, { type: 'error' });
      }
    }
    const retryOrder = (/** @type {Order} */ o) => {
      transition(() => (failed.value = failed.value.filter((x) => x !== o)));
      place({ symbol: o.symbol, side: o.side, type: o.type, qty: o.qty, limit: o.limit }).catch((err) =>
        toast(`Couldn't place the order: ${err?.body?.message ?? err.message}`, { type: 'error' }));
    };

    async function cancel(/** @type {Order} */ o) {
      if (!(await confirm(`Cancel the order to ${describe(o).replace(/^\w/, (c) => c.toLowerCase())}?`, { ok: 'Cancel order', cancel: 'Keep order', danger: true }))) return;
      try {
        await acct.optimistic(
          (/** @type {any} */ a) => ({ ...a, orders: a.orders.map((/** @type {Order} */ x) => (x.id === o.id ? { ...x, status: 'cancelling' } : x)) }),
          () => fetchJSON(`/api/trade?id=${encodeURIComponent(o.id)}`, { method: 'DELETE' })
        );
        toast('Order cancelled', { type: 'success' });
      } catch (/** @type {any} */ err) {
        toast(`Couldn't cancel the order: ${err?.message ?? err}`, { type: 'error' });
      }
    }

    const segment = (/** @type {string} */ name, /** @type {string} */ label, /** @type {[string, string][]} */ options, /** @type {(v: string) => void} */ set) => html`
      <div class=${`segmented ticket-seg ${name}`} role="group" aria-label=${label}>
        ${options.map(([v, text]) => html`<button type="button" data-value=${v} aria-pressed=${() => String(/** @type {any} */ (f)[name].value === v)}
          @click=${() => set(v)}>${text}</button>`)}
      </div>`;

    const statusLine = () => {
      const o = lastOrder.value;
      if (!o) return '';
      if (o.status === 'pending') return html`<span class="order-pill pending">Pending</span> ${describe(o)}…`;
      if (o.status === 'filled') return html`<span class="order-pill filled">Filled</span> ${o.side === 'buy' ? 'Bought' : 'Sold'} ${count(o.qty)} at ${cents(/** @type {number} */ (o.fill))}`;
      return html`<span class="order-pill open">Open</span> ${describe(o)}, waiting for the price`;
    };

    const ticketView = html`
      <section class="card ticket" aria-labelledby="ticket-title">
        <h2 id="ticket-title">Trade ${symbol}</h2>
        <form class="form" novalidate @submit=${ticket.submit}>
          ${segment('side', 'Side', [['buy', 'Buy'], ['sell', 'Sell']], (v) => ticket.set('side', v))}
          ${segment('type', 'Order type', [['market', 'Market'], ['limit', 'Limit']], setType)}
          ${ticket.input('qty', { label: 'Shares', type: 'number', hint: () => (f.side.value === 'sell' ? `You hold ${count(held.value)}` : `Buying power ${cents(power.value)}`) })}
          ${() => (f.type.value === 'limit' ? untrack(() => ticket.input('limit', { label: 'Limit price ($)', type: 'number',
            hint: () => (f.side.value === 'buy' ? 'The most you’ll pay a share' : 'The least you’ll take a share') })) : null)}
          <dl class="ticket-sum">
            <div><dt>${() => (f.type.value === 'limit' ? 'Limit' : 'Market price')}</dt><dd>${() => cents(at.value)}</dd></div>
            <div class=${() => (over.value ? 'total over' : 'total')}><dt>${() => (f.side.value === 'buy' ? 'Estimated cost' : 'Estimated proceeds')}</dt>
              <dd>${() => cents(cost.value)}</dd></div>
            ${() => (over.value ? html`<p class="ticket-warn">More than your buying power by ${cents(cost.value - power.value)}</p>` : null)}
          </dl>
          ${() => (ticket.submitError.value ? html`<p class="form-error" role="alert">${ticket.submitError.value.body?.message ?? ticket.submitError.value.message}</p>` : null)}
          <button class=${() => `btn primary ticket-go ${f.side.value}`} type="submit" ?disabled=${ticket.submitting}>
            ${() => (ticket.submitting.value ? 'Placing…' : `${f.side.value === 'buy' ? 'Buy' : 'Sell'} ${shares.value ? count(shares.value) : ''} ${symbol}`.replace('  ', ' '))}</button>
          <p class="ticket-status" aria-live="polite">${statusLine}</p>
        </form>
      </section>`;

    // ---------- Positions and orders ----------
    const tab = signal(/** @type {'positions' | 'orders'} */ ('positions'));
    const setTab = (/** @type {'positions' | 'orders'} */ t) => transition(() => (tab.value = t));

    /** @param {any} p a position: { symbol, qty, avg } */
    const positionRow = (p) => {
      const pq = feed.get(p.symbol);
      const now = () => pq?.price.value ?? p.avg;
      const pnl = () => (now() - p.avg) * p.qty;
      return html`<tr class=${p.symbol === symbol ? 'current' : null}>
        <th scope="row"><a href=${`/trade/${p.symbol}`}>${p.symbol}</a></th>
        <td class="num">${count(p.qty)}</td>
        <td class="num">${price(p.avg)}</td>
        <td class="num">${() => price(now())}</td>
        <td class="num">${() => cents(now() * p.qty)}</td>
        <td class=${() => `num pnl ${way(pnl())}`}>${() => signedMoney(pnl())}<span class="pnl-pct">${() => percent((pnl() / (p.avg * p.qty)) * 100)}</span></td>
      </tr>`;
    };

    const PILL = { pending: 'Pending', open: 'Open', filled: 'Filled', cancelled: 'Cancelled', cancelling: 'Cancelling…', failed: 'Not placed' };
    /** @param {Order} o */
    const orderRow = (o) => html`<tr class=${o.status}>
      <td class="nowrap muted">${clock(o.at)}</td>
      <th scope="row"><span class=${`side ${o.side}`}>${o.side === 'buy' ? 'Buy' : 'Sell'}</span> ${count(o.qty)} <a href=${`/trade/${o.symbol}`}>${o.symbol}</a></th>
      <td class="nowrap">${o.type === 'limit' ? `Limit ${cents(/** @type {number} */ (o.limit))}` : 'Market'}</td>
      <td><span class=${`order-pill ${o.status}`}>${PILL[o.status]}</span>${o.status === 'filled' ? html` <span class="muted">at ${cents(/** @type {number} */ (o.fill))}</span>` : null}
        ${o.error ? html`<span class="order-error">${o.error}</span>` : null}</td>
      <td class="actions">${o.status === 'open'
        ? html`<button class="btn ghost small-btn" type="button" aria-label=${`Cancel order: ${describe(o)}`} @click=${() => cancel(o)}>Cancel</button>`
        : o.status === 'failed'
          ? html`<button class="btn small-btn" type="button" @click=${() => retryOrder(o)}>${icon('refresh')} Retry</button>
            <button class="icon-btn" type="button" aria-label="Dismiss" @click=${() => transition(() => (failed.value = failed.value.filter((x) => x !== o)))}>${icon('close')}</button>`
          : null}</td>
    </tr>`;

    const accountView = acct.live({
      loading: () => html`<span class="trade-skel tall"></span><p class="sr-only" role="status">Loading your account…</p>`,
      error: (err, retry) => html`<div class="load-error" role="alert"><p>Couldn't load your account. ${err?.message ?? ''}</p>
        <button class="btn" type="button" @click=${retry}>${icon('refresh')} Try again</button></div>`,
      ready: (/** @type {any} */ data) => {
        const positions = computed(() => data.value.positions);
        const orders = computed(() => [...failed.value, ...data.value.orders]);
        const positionsView = () => html`${() => (positions.value.length ? untrack(() => html`
          <div class="acct-table"><table>
            <thead><tr><th scope="col">Symbol</th><th scope="col" class="num">Shares</th><th scope="col" class="num">Avg cost</th>
              <th scope="col" class="num">Last</th><th scope="col" class="num">Value</th><th scope="col" class="num">P&amp;L</th></tr></thead>
            <tbody class="motion">${repeat(positions, (/** @type {any} */ p) => `${p.symbol}:${p.qty}:${p.avg}`, positionRow)}</tbody>
          </table></div>`)
          : html`<p class="empty">No positions yet. Buy something with the ticket.</p>`)}`;
        const ordersView = () => html`${() => (orders.value.length ? untrack(() => html`
          <div class="acct-table"><table>
            <thead><tr><th scope="col">Time</th><th scope="col">Order</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody class="motion">${repeat(orders, (/** @type {Order} */ o) => `${o.id}:${o.status}`, orderRow)}</tbody>
          </table></div>`)
          : html`<p class="empty">No orders today.</p>`)}`;
        return html`
          <div class="acct-head">
            <h2 id="acct-title">Your account</h2>
            <div class="segmented" role="group" aria-label="Show">
              <button type="button" data-tab="positions" aria-pressed=${() => String(tab.value === 'positions')} @click=${() => setTab('positions')}>
                Positions <span class="seg-count">${() => positions.value.length}</span></button>
              <button type="button" data-tab="orders" aria-pressed=${() => String(tab.value === 'orders')} @click=${() => setTab('orders')}>
                Orders <span class="seg-count">${() => orders.value.filter((o) => o.status === 'open' || o.status === 'pending').length || ''}</span></button>
            </div>
          </div>
          <div class="acct-body motion">${() => (tab.value === 'positions' ? untrack(positionsView) : untrack(ordersView))}</div>`;
      },
    });

    // ---------- The page ----------
    const stat = (/** @type {string} */ label, /** @type {unknown} */ value) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`;

    return html`
      <div class="trade-center">
        <header class="quote-head card">
          <div class="quote-id">
            <p class="eyebrow">${q.sector}</p>
            <h1><span class="quote-sym">${symbol}</span> <span class="quote-name">${q.name}</span></h1>
            <a class="wl-jump" href="#watchlist">All symbols</a>
          </div>
          <div class="quote-now">
            <p class="quote-price"><span class="sr-only">Last price </span>${() => price(q.price.value)}<small>USD</small></p>
            <p class=${() => `quote-change ${way(change.value)}`}>
              <span aria-hidden="true">${() => (change.value >= 0 ? '▲' : '▼')}</span>
              ${() => `${signed(change.value)} (${percent(changePct.value)})`}<span class="muted"> today</span></p>
          </div>
          <dl class="quote-stats">
            ${stat('Open', price(q.open))}
            ${stat('High', () => price(q.high.value))}
            ${stat('Low', () => price(q.low.value))}
            ${stat('Prev close', price(q.prevClose))}
            ${stat('Volume', () => volume(q.volume.value))}
          </dl>
          <p class="sr-only" aria-live="polite">${said}</p>
        </header>

        <section class="card trade-chart" aria-labelledby="chart-title" data-busy=${() => (candles.loading.value && candles.status.value === 'ready' ? 'true' : null)}>
          <div class="chart-top">
            <div><h2 id="chart-title">Price</h2><p class="muted note">${() => TF_NAMES[tf.value]}</p></div>
            <div class="segmented" role="group" aria-label="Timeframe">
              ${TIMEFRAMES.map((t) => html`<button type="button" aria-pressed=${() => String(tf.value === t)}
                @click=${() => router.setQuery({ tf: t === '1D' ? null : t })}>${t}</button>`)}
            </div>
          </div>
          ${chartView}
        </section>
      </div>

      <div class="trade-side">
        ${ticketView}
        <section class="card book" aria-labelledby="book-title">
          <h2 id="book-title">Order book</h2>
          <div class="book-cols" aria-hidden="true"><span>Price</span><span>Size</span><span>Total</span></div>
          <ol class="book-side asks" aria-label="Asks (sell orders), highest first: price, size, total">${asks.toReversed().map((l) => levelRow(l, 'ask'))}</ol>
          <p class="book-spread">${() => `Spread ${price(asks[0].price.value - bids[0].price.value)}`}</p>
          <ol class="book-side bids" aria-label="Bids (buy orders), highest first: price, size, total">${bids.map((l) => levelRow(l, 'bid'))}</ol>
        </section>
        <section class="card tape" aria-labelledby="tape-title">
          <h2 id="tape-title">Trades</h2>
          ${() => (trades.value.length ? null : html`<p class="empty">${() => (feed.running.value && feed.status.value === 'live' ? 'Waiting for the next trade…' : 'No trades while the feed is stopped.')}</p>`)}
          <ol class="tape-list" aria-label=${`Recent trades in ${symbol}: time, price, size`}>${repeat(trades, (t) => t.id, tradeRow)}</ol>
        </section>
      </div>

      <section class="card trade-account" aria-labelledby="acct-title">${accountView}</section>`;
  }
}
